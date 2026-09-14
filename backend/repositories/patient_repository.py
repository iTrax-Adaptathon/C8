"""Repository layer: patient persistence and waiting-queue queries."""
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.models.db_models import Patient, utcnow


def _waiting_order(stmt):
    return stmt.order_by(
        Patient.urgency_score.desc(),
        Patient.waiting_since.asc(),
        Patient.id.asc(),
    )


def list_waiting(db: Session) -> List[Patient]:
    """Waiting queue, urgency DESC then waiting_since ASC (the spec query)."""
    return list(db.scalars(_waiting_order(select(Patient).where(Patient.status == "waiting"))))


def list_waiting_by_type(db: Session, resource_type: str) -> List[Patient]:
    stmt = select(Patient).where(
        Patient.status == "waiting",
        Patient.resource_type_needed == resource_type,
    )
    return list(db.scalars(_waiting_order(stmt)))


def list_patients(db: Session, status: Optional[str] = None) -> List[Patient]:
    stmt = select(Patient)
    if status:
        stmt = stmt.where(Patient.status == status)
    stmt = stmt.order_by(Patient.id.asc())
    return list(db.scalars(stmt))


def get_patient(db: Session, patient_id: int) -> Optional[Patient]:
    return db.get(Patient, patient_id)


def get_by_current_resource(db: Session, resource_id: int) -> Optional[Patient]:
    stmt = select(Patient).where(
        Patient.current_resource_id == resource_id,
        Patient.status == "admitted",
    )
    return db.scalars(stmt).first()


def create_patient(
    db: Session, name: str, resource_type_needed: str, urgency_score: int
) -> Patient:
    patient = Patient(
        name=name,
        status="waiting",
        resource_type_needed=resource_type_needed,
        urgency_score=urgency_score,
        waiting_since=utcnow(),
    )
    db.add(patient)
    db.flush()  # assign id without committing
    return patient
