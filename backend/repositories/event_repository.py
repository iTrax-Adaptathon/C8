"""Repository layer: insert-only audit trail.

There is intentionally no update or delete function here - the application
never exposes a path that mutates or removes an event.
"""
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.models.db_models import Event


def add_event(
    db: Session,
    event_type: str,
    patient_id: Optional[int] = None,
    resource_id: Optional[int] = None,
    note: Optional[str] = None,
) -> Event:
    event = Event(
        patient_id=patient_id,
        resource_id=resource_id,
        event_type=event_type,
        note=note,
    )
    db.add(event)
    return event


def list_for_patient(db: Session, patient_id: int) -> List[Event]:
    stmt = (
        select(Event)
        .where(Event.patient_id == patient_id)
        .order_by(Event.created_at.asc(), Event.id.asc())
    )
    return list(db.scalars(stmt))


def list_recent(db: Session, limit: int = 100) -> List[Event]:
    stmt = select(Event).order_by(Event.created_at.desc(), Event.id.desc()).limit(limit)
    return list(db.scalars(stmt))


def latest_for_resource(db: Session, resource_id: int) -> Optional[Event]:
    stmt = (
        select(Event)
        .where(Event.resource_id == resource_id)
        .order_by(Event.id.desc())
        .limit(1)
    )
    return db.scalars(stmt).first()
