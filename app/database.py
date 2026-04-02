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
    message_id   = Column(String, primary_key=True)
    processed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class EmailLog(Base):
    __tablename__ = "email_log"
    message_id      = Column(String, primary_key=True)
    subject         = Column(String, nullable=True)
    sender          = Column(String, nullable=True)
    received        = Column(String, nullable=True)
    needs_response  = Column(Boolean, default=False)
    triage_reason   = Column(Text, nullable=True)
    action_required = Column(Text, nullable=True)
    draft_body      = Column(Text, nullable=True)
    status          = Column(String, default="pending")
    ticket_number   = Column(String, nullable=True)
    processed_at    = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Ticket(Base):
    __tablename__ = "tickets"
    ticket_number    = Column(String, primary_key=True)
    opportunity_id   = Column(String, nullable=True)
    email_message_id = Column(String, nullable=True)
    subject          = Column(String, nullable=True)
    sender           = Column(String, nullable=True)
    company          = Column(String, nullable=True)
    ticket_type      = Column(String, nullable=True)
    status           = Column(String, default="new")
    created_at       = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at       = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Settings(Base):
    __tablename__ = "settings"
    id                  = Column(String, primary_key=True, default="singleton")
    custom_instructions = Column(Text, default="")


class TicketCounter(Base):
    __tablename__ = "ticket_counter"
    id      = Column(String, primary_key=True, default="singleton")
    counter = Column(String, default="0")


def init_db():
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        if not session.get(TicketCounter, "singleton"):
            session.add(TicketCounter(id="singleton", counter="0"))
            session.commit()


def generate_ticket_number() -> str:
    with SessionLocal() as session:
        counter = session.get(TicketCounter, "singleton")
        next_num = int(counter.counter) + 1
        counter.counter = str(next_num)
        session.commit()
        return f"IET-{str(next_num).zfill(4)}"


def create_ticket(
    email_message_id: str,
    subject: str,
    sender: str,
    company: str,
    ticket_type: str,
) -> str:
    ticket_number = generate_ticket_number()
    with SessionLocal() as session:
        ticket = Ticket(
            ticket_number=ticket_number,
            opportunity_id=None,
            email_message_id=email_message_id,
            subject=subject,
            sender=sender,
            company=company,
            ticket_type=ticket_type,
            status="new",
        )
        session.add(ticket)
        session.commit()
    return ticket_number


def find_existing_ticket(sender: str) -> str:
    with SessionLocal() as session:
        # Check by exact sender email first
        existing = (
            session.query(Ticket)
            .filter(Ticket.sender == sender)
            .filter(Ticket.status.notin_(["closed", "paid"]))
            .order_by(Ticket.created_at.desc())
            .first()
        )
        if existing:
            return existing.ticket_number

        # Check by company domain
        if "@" in sender:
            domain = sender.split("@")[1]
            existing_domain = (
                session.query(Ticket)
                .filter(Ticket.sender.like(f"%@{domain}"))
                .filter(Ticket.status.notin_(["closed", "paid"]))
                .order_by(Ticket.created_at.desc())
                .first()
            )
            if existing_domain:
                return existing_domain.ticket_number

        return None


def get_tickets(limit: int = 50):
    with SessionLocal() as session:
        tickets = (
            session.query(Ticket)
            .order_by(Ticket.created_at.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "ticket_number":    t.ticket_number,
                "opportunity_id":   t.opportunity_id,
                "email_message_id": t.email_message_id,
                "subject":          t.subject,
                "sender":           t.sender,
                "company":          t.company,
                "ticket_type":      t.ticket_type,
                "status":           t.status,
                "created_at":       t.created_at.isoformat() if t.created_at else None,
            }
            for t in tickets
        ]


def link_opportunity(ticket_number: str, opportunity_id: str):
    with SessionLocal() as session:
        ticket = session.get(Ticket, ticket_number)
        if ticket:
            ticket.opportunity_id = opportunity_id
            ticket.updated_at = datetime.now(timezone.utc)
            session.commit()
            return True
        return False


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
    ticket_number: str = None,
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
            ticket_number=ticket_number,
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
                "ticket_number":   log.ticket_number,
                "processed_at":    log.processed_at.isoformat() if log.processed_at else None,
            }
            for log in logs
        ]


def get_settings(session) -> Settings:
    return session.query(Settings).first()