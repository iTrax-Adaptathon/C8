"""SQLAlchemy ORM mappings for the exactly-3-table data model.

resources  -> current commitment state lives here (available | committed)
patients   -> waiting | admitted | discharged, one primary resource type
events     -> insert-only audit trail (never updated or deleted)
"""
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String

from backend.database import Base


def utcnow() -> datetime:
    """Naive UTC timestamp.

    SQLite stores datetimes without timezone info, so we keep everything in
    naive UTC for a consistent, comparable value in the database.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, autoincrement=True)
    type = Column(String, nullable=False, index=True)  # bed | theatre | staff
    name = Column(String, nullable=False)
    status = Column(String, nullable=False, default="available", index=True)
    version = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    status = Column(String, nullable=False, default="waiting", index=True)
    resource_type_needed = Column(String, nullable=False)  # bed | theatre | staff
    urgency_score = Column(Integer, nullable=False, default=3)
    waiting_since = Column(DateTime, nullable=False, default=utcnow)
    # Current resource pointer (nullable). The full history still lives in
    # `events`; this column only answers "which resource do I free on
    # discharge?".  Keeping it avoids fragile event-scanning. See TODO.md.
    current_resource_id = Column(Integer, ForeignKey("resources.id"), nullable=True)


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=True)
    resource_id = Column(Integer, ForeignKey("resources.id"), nullable=True)
    event_type = Column(String, nullable=False, index=True)
    note = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utcnow, index=True)
