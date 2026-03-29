from sqlalchemy import create_engine, Column, String, DateTime, Text
from sqlalchemy.orm import declarative_base, sessionmaker
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


class Settings(Base):
    __tablename__ = "settings"
    id = Column(String, primary_key=True, default="singleton")
    custom_instructions = Column(Text, default="")


def init_db():
    Base.metadata.create_all(bind=engine)


def is_already_processed(message_id: str) -> bool:
    with SessionLocal() as session:
        result = session.get(ProcessedEmail, message_id)
        return result is not None


# def mark_as_processed(message_id: str):
#     with SessionLocal() as session:
#         if not session.get(ProcessedEmail, message_id):
#             session.add(ProcessedEmail(message_id=message_id))
#             session.commit()

def mark_as_processed(message_id: str):
    with SessionLocal() as session:
        try:
            session.add(ProcessedEmail(message_id=message_id))
            session.commit()
        except Exception:
            session.rollback()


def get_settings(session) -> Settings:
    return session.query(Settings).first()