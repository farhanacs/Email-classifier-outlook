import anthropic
import requests
import os
import asyncio
from fastapi import FastAPI, Request, BackgroundTasks
from fastapi.responses import PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from app.models import TriageResult, DraftResult
from datetime import datetime, timezone, timedelta
from app.database import init_db, is_already_processed, mark_as_processed
from app.logger import get_logger
from pydantic import BaseModel
from typing import Optional

load_dotenv()

# ── LOGGER ────────────────────────────────────────────────────────────────────
logger = get_logger("iet-email-agent")

# ── CONFIG ────────────────────────────────────────────────────────────────────
CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")
TENANT_ID = os.getenv("TENANT_ID")
EMAIL_ADDRESS = os.getenv("EMAIL_ADDRESS")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
RENDER_URL = os.getenv("RENDER_URL")

anthropic_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
current_subscription_id = None

# ── PYDANTIC MODELS ───────────────────────────────────────────────────────────
class SettingsUpdate(BaseModel):
    custom_instructions: str


# ── MICROSOFT GRAPH ───────────────────────────────────────────────────────────
def get_access_token():
    try:
        url = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"
        data = {
            "grant_type": "client_credentials",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "scope": "https://graph.microsoft.com/.default"
        }
        response = requests.post(url, data=data)
        token = response.json().get("access_token")
        if not token:
            logger.error(f"Failed to get access token: {response.json()}")
        return token
    except Exception as e:
        logger.error(f"Exception getting access token: {str(e)}")
        return None


def get_emails(token, count=20):
    try:
        url = f"https://graph.microsoft.com/v1.0/users/{EMAIL_ADDRESS}/messages?$top={count}&$orderby=receivedDateTime desc&$select=id,subject,body,from,receivedDateTime,conversationId"
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(url, headers=headers)
        return response.json().get("value", [])
    except Exception as e:
        logger.error(f"Exception fetching emails: {str(e)}")
        return []


def fetch_single_email(token, message_id):
    try:
        url = f"https://graph.microsoft.com/v1.0/users/{EMAIL_ADDRESS}/messages/{message_id}"
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            return response.json()
        logger.error(f"Failed to fetch email {message_id} — status {response.status_code}")
        return None
    except Exception as e:
        logger.error(f"Exception fetching single email: {str(e)}")
        return None


def create_draft_reply(token, message_id, draft_body, original_html=""):
    try:
        url = f"https://graph.microsoft.com/v1.0/users/{EMAIL_ADDRESS}/messages/{message_id}/createReply"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        response = requests.post(url, headers=headers)

        if response.status_code != 201:
            logger.error(f"Failed to create reply — status {response.status_code}: {response.text}")
            return None

        draft = response.json()
        draft_id = draft.get("id")

        # Format draft body as HTML and preserve original email thread below
        html_body = f"""
<div style='font-family:Arial,sans-serif;font-size:11pt;color:#000000;'>
{draft_body.replace(chr(10), '<br>')}
</div>
<br><br>
{original_html}
"""

        update_url = f"https://graph.microsoft.com/v1.0/users/{EMAIL_ADDRESS}/messages/{draft_id}"
        update_payload = {
            "body": {
                "contentType": "HTML",
                "content": html_body
            },
            "categories": ["AI generated"],
            "subject": draft.get("subject", "")
        }

        update_response = requests.patch(update_url, headers=headers, json=update_payload)

        if update_response.status_code != 200:
            logger.error(f"Failed to update draft — status {update_response.status_code}: {update_response.text}")
            return None

        logger.info(f"Draft created successfully for message: {message_id}")
        return update_response.json()

    except Exception as e:
        logger.error(f"Exception creating draft: {str(e)}")
        return None


# ── WEBHOOK REGISTRATION ──────────────────────────────────────────────────────
def register_webhook(notification_url: str):
    global current_subscription_id
    try:
        token = get_access_token()
        url = "https://graph.microsoft.com/v1.0/subscriptions"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        expiry = (datetime.now(timezone.utc) + timedelta(minutes=4200)).strftime("%Y-%m-%dT%H:%M:%S.0000000Z")

        payload = {
            "changeType": "created",
            "notificationUrl": f"{notification_url}/webhook",
            "resource": f"users/{EMAIL_ADDRESS}/mailfolders('Inbox')/messages",
            "expirationDateTime": expiry,
            "clientState": "ietlabs-secret-state"
        }

        response = requests.post(url, headers=headers, json=payload)
        result = response.json()

        if response.status_code == 201:
            current_subscription_id = result.get("id")
            logger.info(f"Webhook registered. ID: {current_subscription_id} Expires: {expiry}")
        else:
            logger.error(f"Failed to register webhook: {result}")

        return result

    except Exception as e:
        logger.error(f"Exception registering webhook: {str(e)}")
        return None


# ── AUTO RENEWAL ──────────────────────────────────────────────────────────────
def renew_webhook():
    global current_subscription_id
    if not current_subscription_id:
        logger.warning("No subscription ID — re-registering webhook")
        register_webhook(RENDER_URL)
        return

    try:
        token = get_access_token()
        url = f"https://graph.microsoft.com/v1.0/subscriptions/{current_subscription_id}"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        new_expiry = (datetime.now(timezone.utc) + timedelta(minutes=4200)).strftime("%Y-%m-%dT%H:%M:%S.0000000Z")
        payload = {"expirationDateTime": new_expiry}

        response = requests.patch(url, headers=headers, json=payload)

        if response.status_code == 200:
            logger.info(f"Webhook renewed until {new_expiry}")
        else:
            logger.error(f"Failed to renew — status {response.status_code}: {response.text}")
            logger.info("Re-registering webhook")
            register_webhook(RENDER_URL)

    except Exception as e:
        logger.error(f"Exception renewing webhook: {str(e)}")


async def auto_renew_loop():
    while True:
        await asyncio.sleep(20 * 60 * 60)
        logger.info("Running scheduled webhook renewal")
        renew_webhook()


# ── SETTINGS / PROMPT INJECTION ───────────────────────────────────────────────
def get_custom_instructions() -> str:
    try:
        from database import get_settings, SessionLocal
        with SessionLocal() as session:
            settings = get_settings(session)
            return settings.custom_instructions if settings else ""
    except Exception as e:
        logger.error(f"Failed to get custom instructions: {str(e)}")
        return ""


# ── AGENTS ────────────────────────────────────────────────────────────────────
def triage_email(subject, body, sender) -> TriageResult:
    try:
        prompt = f"""You are a triage agent for IET Labs, a manufacturer of test and measurement equipment.

Read the following email and decide if it needs a response or not.

Emails that DO NOT need a response:
- Thank you emails
- Simple acknowledgements like got it sounds good great
- One word or one line replies with no question or request
- Payment confirmation notifications with no question
- Internal emails between IET Labs staff members
- Emails sent from an ietlabs.com email address to another ietlabs.com address

Emails that DO need a response:
- RFQ requests asking for a quote on a product
- Service requests for repair or calibration
- Purchase orders
- Questions about order status
- Complaints or issues
- Any email with a clear question or request

Email details:
Sender: {sender}
Subject: {subject}
Body: {body[:2000]}"""

        response = anthropic_client.messages.parse(
            model="claude-sonnet-4-6",
            max_tokens=5000,
            output_format=TriageResult,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].parsed_output

    except Exception as e:
        logger.error(f"Triage failed for {sender}: {str(e)}")
        raise


def draft_response(subject, body, sender) -> DraftResult:
    try:
        custom_instructions = get_custom_instructions()

        custom_block = ""
        if custom_instructions:
            custom_block = f"""
CUSTOM INSTRUCTIONS FROM IET LABS — follow these in addition to all rules below:
{custom_instructions}
---
"""

        prompt = f"""You are a helpful assistant drafting email responses on behalf of IET Labs, a world leading manufacturer of test and measurement equipment including resistors capacitors and inductors.

Draft a professional and concise response to the following email.

{custom_block}
STRICT RULES — you must follow these without exception:

1. NEVER use vague filler phrases such as:
   - "we will look into this"
   - "we will get back to you"
   - "we are looking into your request"
   - "we will follow up shortly"
   - "we will keep you updated"
   - "thank you for reaching out we will respond soon"
   - Any similar non-committal language that provides no value to the customer

2. Every response must be specific and actionable. If you do not have enough information to give a specific response then ask clearly for the missing information.

3. If the email requires a manual action by an IET staff member before the response can be sent such as pulling invoices checking an order printing a document or looking up a tracking number then:
   - Set action_required to a clear instruction for the IET staff member describing exactly what they need to do before sending
   - Write the draft_body assuming that action has already been completed
   - For example if someone requests invoices write the response as if the invoices are already attached

4. Specific guidelines per email type:
   - RFQ: Confirm the exact product requested and state that a detailed quote including pricing and lead time is being prepared
   - Service or calibration request: Confirm receipt of the request provide the next steps and ask for serial number if not provided
   - Status request: Set action_required to check the order status in the system then write the response assuming you have that status
   - Purchase order: Confirm the specific order details including product quantity and delivery and outline the next steps
   - Invoice request: Set action_required to locate and attach the relevant invoices then write the response as if invoices are attached
   - General question: Answer it directly and specifically

5. Do not make up specific prices lead times or product details
6. Never ask for information that has already been provided in the email
7. Sign off as IET Labs Sales Team

Email details:
Sender: {sender}
Subject: {subject}
Body: {body[:2000]}"""

        response = anthropic_client.messages.parse(
            model="claude-sonnet-4-6",
            max_tokens=5000,
            output_format=DraftResult,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].parsed_output

    except Exception as e:
        logger.error(f"Drafting failed for {sender}: {str(e)}")
        raise


# ── PROCESS SINGLE EMAIL ──────────────────────────────────────────────────────
def process_single_email(message_id: str):
    try:
        if is_already_processed(message_id):
            logger.info(f"Email {message_id} already processed — skipping")
            return

        token = get_access_token()
        email = fetch_single_email(token, message_id)

        if not email:
            return

        subject = email.get("subject", "No Subject")
        body = email.get("body", {}).get("content", "")
        original_html = email.get("body", {}).get("content", "") if email.get("body", {}).get("contentType") == "html" else ""
        sender = email.get("from", {}).get("emailAddress", {}).get("address", "Unknown")

        logger.info(f"Processing: '{subject}' from {sender}")

        if sender.lower().endswith("@ietlabs.com"):
            logger.info(f"Skipping internal email from {sender}")
            mark_as_processed(message_id)
            return

        triage = triage_email(subject, body, sender)
        logger.info(f"Triage: needs_response={triage.needs_response} reason={triage.reason}")

        if triage.needs_response:
            draft = draft_response(subject, body, sender)
            action_required = draft.action_required

            if action_required:
                full_draft_body = f"--- ACTION REQUIRED FOR IET STAFF ---\n{action_required}\n--------------------------------------\n\n{draft.draft_body}"
            else:
                full_draft_body = draft.draft_body

            result = create_draft_reply(token, message_id, full_draft_body, original_html)
            if result:
                logger.info(f"Draft created for: {subject}")
            else:
                logger.error(f"Failed to create draft for: {subject}")

        mark_as_processed(message_id)

    except Exception as e:
        logger.error(f"Unhandled exception processing {message_id}: {str(e)}")


# ── LIFESPAN ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger.info("Database initialized")
    asyncio.create_task(auto_renew_loop())
    logger.info("Auto renewal loop started")
    yield
    logger.info("Application shutting down")


# ── APP INIT ──────────────────────────────────────────────────────────────────
app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── WEBHOOK ENDPOINT ──────────────────────────────────────────────────────────
@app.post("/webhook")
async def webhook(request: Request, background_tasks: BackgroundTasks):
    params = request.query_params
    if "validationToken" in params:
        logger.info("Webhook validation received")
        return PlainTextResponse(
            content=params["validationToken"],
            status_code=200
        )

    try:
        body = await request.json()
        notifications = body.get("value", [])

        for notification in notifications:
            if notification.get("clientState") != "ietlabs-secret-state":
                logger.warning("Invalid client state — ignoring")
                continue

            resource = notification.get("resource", "")
            message_id = resource.split("/")[-1]
            logger.info(f"Notification received for: {message_id}")
            background_tasks.add_task(process_single_email, message_id)

    except Exception as e:
        logger.error(f"Exception in webhook: {str(e)}")

    return {"status": "ok"}


# ── REGISTER WEBHOOK ──────────────────────────────────────────────────────────
@app.get("/register-webhook")
def register_webhook_endpoint():
    result = register_webhook(RENDER_URL)
    return result


# ── API: GET EMAILS ───────────────────────────────────────────────────────────
@app.get("/api/emails")
def get_emails_api():
    token = get_access_token()
    emails = get_emails(token)
    results = []

    for email in emails:
        message_id = email.get("id", "")
        subject = email.get("subject", "No Subject")
        body = email.get("body", {}).get("content", "")
        sender = email.get("from", {}).get("emailAddress", {}).get("address", "Unknown")
        received = email.get("receivedDateTime", "")
        already_processed = is_already_processed(message_id)

        results.append({
            "message_id": message_id,
            "subject": subject,
            "sender": sender,
            "received": received,
            "already_processed": already_processed,
            "body_preview": body[:300]
        })

    return results


# ── API: ON DEMAND PROCESS EMAIL ──────────────────────────────────────────────
@app.post("/api/process-email/{message_id}")
async def process_email_on_demand(message_id: str, background_tasks: BackgroundTasks):
    if is_already_processed(message_id):
        return {"status": "already_processed", "message": "This email has already been processed"}

    background_tasks.add_task(process_single_email, message_id)
    return {"status": "processing", "message": "Email is being processed in the background"}


# ── API: STATS ────────────────────────────────────────────────────────────────
@app.get("/api/stats")
def get_stats():
    try:
        from database import SessionLocal, ProcessedEmail
        from sqlalchemy import func
        today = datetime.now(timezone.utc).date()

        with SessionLocal() as session:
            total_processed = session.query(func.count(ProcessedEmail.message_id)).scalar()
            processed_today = session.query(func.count(ProcessedEmail.message_id)).filter(
                func.date(ProcessedEmail.processed_at) == today
            ).scalar()

        return {
            "total_processed": total_processed,
            "processed_today": processed_today,
            "webhook_active": current_subscription_id is not None,
            "subscription_id": current_subscription_id
        }
    except Exception as e:
        logger.error(f"Error getting stats: {str(e)}")
        return {"error": str(e)}


# ── API: GET SETTINGS ─────────────────────────────────────────────────────────
@app.get("/api/settings")
def get_settings_api():
    try:
        from database import SessionLocal, Settings
        with SessionLocal() as session:
            settings = session.query(Settings).first()
            if settings:
                return {"custom_instructions": settings.custom_instructions}
            return {"custom_instructions": ""}
    except Exception as e:
        logger.error(f"Error getting settings: {str(e)}")
        return {"custom_instructions": ""}


# ── API: SAVE SETTINGS ────────────────────────────────────────────────────────
@app.post("/api/settings")
def save_settings_api(data: SettingsUpdate):
    try:
        from database import SessionLocal, Settings
        with SessionLocal() as session:
            settings = session.query(Settings).first()
            if settings:
                settings.custom_instructions = data.custom_instructions
            else:
                session.add(Settings(custom_instructions=data.custom_instructions))
            session.commit()
            logger.info("Custom instructions updated")
            return {"status": "saved", "custom_instructions": data.custom_instructions}
    except Exception as e:
        logger.error(f"Error saving settings: {str(e)}")
        return {"error": str(e)}


# ── RUN ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)