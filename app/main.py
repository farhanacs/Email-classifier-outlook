import anthropic
import requests
import os
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
from models import TriageResult, DraftResult

load_dotenv()

# ── CONFIG ──────────────────────────────────────────────────────────────────
CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")
TENANT_ID = os.getenv("TENANT_ID")
EMAIL_ADDRESS = os.getenv("EMAIL_ADDRESS")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")



# ── INIT ─────────────────────────────────────────────────────────────────────
app = FastAPI()
anthropic_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

# ── MICROSOFT GRAPH ──────────────────────────────────────────────────────────
def get_access_token():
    url = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"
    data = {
        "grant_type": "client_credentials",
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "scope": "https://graph.microsoft.com/.default"
    }
    response = requests.post(url, data=data)
    return response.json().get("access_token")


def get_emails(token, count=10):
    url = f"https://graph.microsoft.com/v1.0/users/{EMAIL_ADDRESS}/messages?$top={count}&$orderby=receivedDateTime desc&$select=id,subject,body,from,receivedDateTime,conversationId"
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, headers=headers)
    return response.json().get("value", [])


def create_draft_reply(token, message_id, draft_body):
    url = f"https://graph.microsoft.com/v1.0/users/{EMAIL_ADDRESS}/messages/{message_id}/createReply"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    print(f"\n--- CREATE DRAFT REPLY ---")
    print(f"Message ID: {message_id}")
    print(f"URL: {url}")
    
    response = requests.post(url, headers=headers)
    
    print(f"Create Reply Status Code: {response.status_code}")
    print(f"Create Reply Response: {response.text}")

    if response.status_code != 201:
        print(f"FAILED at createReply step — status code {response.status_code}")
        return None

    draft = response.json()
    draft_id = draft.get("id")
    print(f"Draft ID: {draft_id}")

    update_url = f"https://graph.microsoft.com/v1.0/users/{EMAIL_ADDRESS}/messages/{draft_id}"
    update_payload = {
        "body": {
            "contentType": "Text",
            "content": draft_body
        }
    }
    
    print(f"Update URL: {update_url}")
    print(f"Draft Body Preview: {draft_body[:200]}")

    update_response = requests.patch(update_url, headers=headers, json=update_payload)
    
    print(f"Update Status Code: {update_response.status_code}")
    print(f"Update Response: {update_response.text}")
    print(f"--- END CREATE DRAFT REPLY ---\n")
    
    return update_response.json()


# ── AGENT 1: TRIAGE ──────────────────────────────────────────────────────────
def triage_email(subject, body, sender) -> TriageResult:
    prompt = f"""You are a triage agent for IET Labs, a manufacturer of test and measurement equipment.

Read the following email and decide if it needs a response or not.

Emails that DO NOT need a response:
- Thank you emails
- Simple acknowledgements like got it sounds good great
- One word or one line replies with no question or request
- Payment confirmation notifications with no question

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


# ── AGENT 2: DRAFTING ────────────────────────────────────────────────────────
def draft_response(subject, body, sender) -> DraftResult:
    prompt = f"""You are a helpful assistant drafting email responses on behalf of IET Labs, a world leading manufacturer of test and measurement equipment including resistors capacitors and inductors.

Draft a professional and concise response to the following email.

Guidelines:
- Be professional but friendly
- Keep it concise and to the point
- If it is an RFQ acknowledge the request and let them know the team will get back with a quote
- If it is a service or calibration request acknowledge and ask for the serial number if not provided
- If it is a status request acknowledge and let them know the team will look into it
- If it is a purchase order acknowledge receipt and confirm next steps
- Do not make up specific prices lead times or product details
- Sign off as IET Labs Sales Team

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


# ── PROCESS EMAILS ───────────────────────────────────────────────────────────
def process_emails():
    token = get_access_token()
    emails = get_emails(token)
    results = []

    for email in emails:
        message_id = email.get("id", "")
        subject = email.get("subject", "No Subject")
        body = email.get("body", {}).get("content", "")
        sender = email.get("from", {}).get("emailAddress", {}).get("address", "Unknown")
        received = email.get("receivedDateTime", "")

        needs_response = False
        triage_reason = ""
        draft_body = None
        draft_subject = None
        draft_status = None

        try:
            triage: TriageResult = triage_email(subject, body, sender)
            needs_response = triage.needs_response
            triage_reason = triage.reason
        except Exception as e:
            triage_reason = f"Triage failed: {str(e)}"

        if needs_response:
            try:
                draft: DraftResult = draft_response(subject, body, sender)
                draft_body = draft.draft_body
                draft_subject = draft.subject_line
                draft_result = create_draft_reply(token, message_id, draft_body)
                draft_status = "Draft saved to Outlook" if draft_result else "Failed to save draft"
            except Exception as e:
                draft_status = f"Drafting failed: {str(e)}"

        results.append({
            "subject": subject,
            "sender": sender,
            "received": received,
            "needs_response": needs_response,
            "triage_reason": triage_reason,
            "draft_body": draft_body,
            "draft_subject": draft_subject,
            "draft_status": draft_status
        })

    return results


# ── DASHBOARD ────────────────────────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse)
def dashboard():
    results = process_emails()

    cards = ""
    for r in results:
        needs_response = r.get("needs_response", False)
        status_color = "#27AE60" if needs_response else "#95A5A6"
        status_label = "Response Needed" if needs_response else "No Response Needed"
        draft_status = r.get("draft_status", "")
        draft_body = r.get("draft_body", "")
        draft_subject = r.get("draft_subject", "")
        triage_reason = r.get("triage_reason", "")

        draft_section = ""
        if draft_body:
            draft_section = f"""
            <div style='margin-top:12px;background:#F8F9FA;border-radius:8px;padding:12px;'>
                <p style='font-size:11px;font-weight:600;color:#666;text-transform:uppercase;margin-bottom:4px;'>Draft Subject</p>
                <p style='font-size:13px;color:#2C3E50;margin-bottom:10px;'>{draft_subject}</p>
                <p style='font-size:11px;font-weight:600;color:#666;text-transform:uppercase;margin-bottom:4px;'>Draft Response</p>
                <p style='font-size:13px;color:#2C3E50;white-space:pre-wrap;'>{draft_body}</p>
            </div>"""

        draft_status_html = ""
        if draft_status:
            ds_color = "#27AE60" if "saved" in draft_status.lower() else "#E74C3C"
            draft_status_html = f"<span style='font-size:11px;color:{ds_color};font-weight:600;'>{draft_status}</span>"

        cards += f"""
        <div style='background:white;border-radius:12px;padding:20px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.08);border-left:5px solid {status_color};'>
            <div style='display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;'>
                <div style='flex:1;'>
                    <p style='margin:0 0 4px 0;font-weight:600;font-size:15px;color:#2C3E50;'>{r["subject"]}</p>
                    <p style='margin:0 0 4px 0;font-size:12px;color:#666;'>From: {r["sender"]}</p>
                    <p style='margin:0 0 4px 0;font-size:12px;color:#666;'>Received: {r["received"]}</p>
                    <p style='margin:6px 0 0 0;font-size:13px;color:#555;'>{triage_reason}</p>
                    {draft_status_html}
                </div>
                <div style='text-align:right;'>
                    <span style='background:{status_color};color:white;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;'>{status_label}</span>
                </div>
            </div>
            {draft_section}
        </div>"""

    total = len(results)
    drafted = sum(1 for r in results if r.get("needs_response"))
    skipped = total - drafted

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>IET Labs Email Drafting Agent</title>
        <meta charset='utf-8'>
        <meta name='viewport' content='width=device-width, initial-scale=1'>
        <style>
            * {{ box-sizing: border-box; margin: 0; padding: 0; }}
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F0F2F5; min-height: 100vh; }}
            .header {{ background: #2C3E50; color: white; padding: 20px 32px; display: flex; justify-content: space-between; align-items: center; }}
            .header h1 {{ font-size: 20px; font-weight: 600; }}
            .header p {{ font-size: 13px; opacity: 0.7; margin-top: 4px; }}
            .refresh-btn {{ background: #3498DB; color: white; border: none; padding: 8px 18px; border-radius: 8px; cursor: pointer; font-size: 13px; }}
            .refresh-btn:hover {{ background: #2980B9; }}
            .container {{ max-width: 960px; margin: 0 auto; padding: 24px 16px; }}
            .stats {{ display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }}
            .stat-box {{ background: white; border-radius: 10px; padding: 16px 24px; box-shadow: 0 2px 6px rgba(0,0,0,0.06); }}
            .stat-box p:first-child {{ font-size: 28px; font-weight: 700; color: #2C3E50; }}
            .stat-box p:last-child {{ font-size: 12px; color: #666; margin-top: 4px; }}
            .section-title {{ font-size: 14px; font-weight: 600; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }}
        </style>
    </head>
    <body>
        <div class='header'>
            <div>
                <h1>IET Labs Email Drafting Agent</h1>
                <p>Powered by Claude</p>
            </div>
            <button class='refresh-btn' onclick='window.location.reload()'>Refresh</button>
        </div>
        <div class='container'>
            <div class='stats'>
                <div class='stat-box'>
                    <p>{total}</p>
                    <p>Emails Processed</p>
                </div>
                <div class='stat-box'>
                    <p style='color:#27AE60;'>{drafted}</p>
                    <p>Drafts Created</p>
                </div>
                <div class='stat-box'>
                    <p style='color:#95A5A6;'>{skipped}</p>
                    <p>Skipped</p>
                </div>
            </div>
            <p class='section-title'>Processed Emails</p>
            {cards}
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html)


@app.get("/api/emails")
def get_emails_api():
    return process_emails()


# ── RUN ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)