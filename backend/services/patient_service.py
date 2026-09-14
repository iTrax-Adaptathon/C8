"""Service layer: patient intake, queue, discharge, history."""
from typing import List, Optional

from sqlalchemy.orm import Session

from backend.domain import care_path
from backend.errors import ConflictError, NotFoundError, UnprocessableError
from backend.repositories import event_repository as event_repo
from backend.repositories import patient_repository as patient_repo
from backend.repositories import resource_repository as resource_repo
from backend.schemas.pydantic_schemas import PatientCreate
from backend.services import matching_service


def create_patient(db: Session, data: PatientCreate):
    patient = patient_repo.create_patient(
        db,
        name=data.name.strip(),
        resource_type_needed=data.resource_type_needed,
        urgency_score=data.urgency_score,
    )
    event_repo.add_event(
        db,
        "patient_created",
        patient_id=patient.id,
        note=f"{patient.name} registered needing a {patient.resource_type_needed} "
        f"(urgency {patient.urgency_score}).",
    )
    event_repo.add_event(
        db,
        "patient_waiting",
        patient_id=patient.id,
        note=f"{patient.name} joined the waiting queue.",
    )
    matching_service.record_trigger(db, patient.resource_type_needed)
    db.commit()
    db.refresh(patient)
    return patient


def list_waiting(db: Session):
    return patient_repo.list_waiting(db)


def list_patients(db: Session, status: Optional[str] = None):
    return patient_repo.list_patients(db, status)


def get_patient(db: Session, patient_id: int):
    patient = patient_repo.get_patient(db, patient_id)
    if patient is None:
        raise NotFoundError(f"Patient {patient_id} was not found.")
    return patient


def get_history(db: Session, patient_id: int):
    get_patient(db, patient_id)  # 404 if missing
    return event_repo.list_for_patient(db, patient_id)


def discharge(db: Session, patient_id: int):
    """Discharge a patient, release any linked resource, trigger matching."""
    patient = get_patient(db, patient_id)
    if patient.status == "discharged":
        raise ConflictError(f"{patient.name} is already discharged.")

    resource = None
    if patient.current_resource_id is not None:
        resource = resource_repo.get_resource(db, patient.current_resource_id)

    if resource is not None and resource.status == "committed":
        if resource_repo.try_release(db, resource.id):
            event_repo.add_event(
                db,
                "resource_released",
                patient_id=patient.id,
                resource_id=resource.id,
                note=f"{resource.name} released on discharge of {patient.name}.",
            )

    patient.status = "discharged"
    patient.current_resource_id = None
    event_repo.add_event(
        db,
        "patient_discharged",
        patient_id=patient.id,
        resource_id=resource.id if resource else None,
        note=f"{patient.name} discharged.",
    )
    if resource is not None:
        matching_service.record_trigger(db, resource.type)
    db.commit()
    db.refresh(patient)
    return patient


def transfer(db: Session, patient_id: int, target_resource_id: int):
    """Step a patient down the care path (ICU -> ward, theatre -> ICU).

    The patient stays admitted; only the committed resource changes. The
    source bed is released back to available in the same transaction.
    """
    patient = get_patient(db, patient_id)
    if patient.status != "admitted" or patient.current_resource_id is None:
        raise ConflictError(f"{patient.name} is not currently admitted to a resource.")

    source = resource_repo.get_resource(db, patient.current_resource_id)
    target = resource_repo.get_resource(db, target_resource_id)
    if source is None:
        raise NotFoundError("The patient's current resource was not found.")
    if target is None:
        raise NotFoundError(f"Resource {target_resource_id} was not found.")
    if target.status != "available":
        raise ConflictError(f"{target.name} is already committed. Transfer rejected.")
    if not care_path.is_valid_transfer_target(source, target):
        expected = care_path.transfer_target_kind(source)
        if expected is None:
            raise UnprocessableError(
                f"{patient.name} in {source.name} cannot be transferred; discharge instead."
            )
        raise UnprocessableError(
            f"Transfer from {source.name} must go to an available {expected} bed, "
            f"not {target.name}."
        )

    if not resource_repo.try_release(db, source.id):
        db.rollback()
        raise ConflictError(
            f"{source.name} was already released by another request. Transfer rejected."
        )
    if not resource_repo.try_commit(db, target.id):
        db.rollback()
        raise ConflictError(
            f"{target.name} was committed by another request. Transfer rejected."
        )

    patient.current_resource_id = target.id
    event_repo.add_event(
        db,
        "resource_released",
        patient_id=patient.id,
        resource_id=source.id,
        note=f"{source.name} released as {patient.name} stepped down.",
    )
    event_repo.add_event(
        db,
        "resource_committed",
        patient_id=patient.id,
        resource_id=target.id,
        note=f"{target.name} committed to {patient.name} (transfer).",
    )
    event_repo.add_event(
        db,
        "patient_transferred",
        patient_id=patient.id,
        resource_id=target.id,
        note=f"{patient.name} transferred from {source.name} to {target.name}.",
    )
    matching_service.record_trigger(db, source.type)
    db.commit()
    db.refresh(patient)
    return patient
