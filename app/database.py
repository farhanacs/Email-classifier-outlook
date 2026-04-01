from sqlalchemy import create_engine, Column, String, DateTime, Text, Boolean
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.dialects.postgresql import insert
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class ProcessedEmail(Base):
    __tablename__ = "processed_emails"
    message_id = Column(String, primary_key=True)
    processed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class EmailLog(Base):
    __tablename__ = "email_log"
    message_id       = Column(String, primary_key=True)
    subject          = Column(String, nullable=True)
    sender           = Column(String, nullable=True)
    received         = Column(String, nullable=True)
    needs_response   = Column(Boolean, default=False)
    triage_reason    = Column(Text, nullable=True)
    action_required  = Column(Text, nullable=True)
    draft_body       = Column(Text, nullable=True)
    status           = Column(String, default="pending")
    # status values:
    # "skipped"      — triage said no response needed
    # "draft_saved"  — draft created and saved to Outlook
    # "draft_failed" — drafting or saving failed
    # "internal"     — skipped because internal email
    processed_at     = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Settings(Base):
    __tablename__ = "settings"
    id                  = Column(String, primary_key=True, default="singleton")
    custom_instructions = Column(Text, default="")


def init_db():
    Base.metadata.create_all(bind=engine)


def is_already_processed(message_id: str) -> bool:
    with SessionLocal() as session:
        result = session.get(ProcessedEmail, message_id)
        return result is not None


def mark_as_processed(message_id: str):
    with SessionLocal() as session:
        stmt = insert(ProcessedEmail).values(
            message_id=message_id,
            processed_at=datetime.now(timezone.utc)
        ).on_conflict_do_nothing(index_elements=["message_id"])
        session.execute(stmt)
        session.commit()


def save_email_log(
    message_id: str,
    subject: str,
    sender: str,
    received: str,
    needs_response: bool,
    triage_reason: str,
    action_required: str,
    draft_body: str,
    status: str,
):
    with SessionLocal() as session:
        stmt = insert(EmailLog).values(
            message_id=message_id,
            subject=subject,
            sender=sender,
            received=received,
            needs_response=needs_response,
            triage_reason=triage_reason,
            action_required=action_required,
            draft_body=draft_body,
            status=status,
            processed_at=datetime.now(timezone.utc)
        ).on_conflict_do_nothing(index_elements=["message_id"])
        session.execute(stmt)
        session.commit()


def get_email_logs(limit: int = 50):
    with SessionLocal() as session:
        logs = (
            session.query(EmailLog)
            .order_by(EmailLog.processed_at.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "message_id":      log.message_id,
                "subject":         log.subject,
                "sender":          log.sender,
                "received":        log.received,
                "needs_response":  log.needs_response,
                "triage_reason":   log.triage_reason,
                "action_required": log.action_required,
                "draft_body":      log.draft_body,
                "status":          log.status,
                "processed_at":    log.processed_at.isoformat() if log.processed_at else None,
            }
            for log in logs
        ]


def get_settings(session) -> Settings:
    return session.query(Settings).first()