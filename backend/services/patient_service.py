"""Service layer: patient intake, queue, discharge, history, and status transitions."""
from typing import List, Optional

from sqlalchemy.orm import Session

from backend.domain import care_path
from backend.domain.matching_engine import waiting_minutes
from backend.domain.state_machine import assert_patient_transition
from backend.errors import ConflictError, NotFoundError, UnprocessableError
from backend.repositories import event_repository as event_repo
from backend.repositories import patient_repository as patient_repo
from backend.repositories import resource_repository as resource_repo
from backend.schemas.pydantic_schemas import PatientCreate
from backend.services import matching_service


def create_patient(db: Session, data: PatientCreate):
    status = data.status or "waiting"
    patient = patient_repo.create_patient(
        db,
        name=data.name.strip(),
        resource_type_needed=data.resource_type_needed,
        urgency_score=data.urgency_score,
        severity=data.severity or "Medium",
        department=data.department,
        specialty_needed=data.specialty_needed,
        ambulance_id=data.ambulance_id,
        eta_minutes=data.eta_minutes,
        status=status,
    )
    event_repo.add_event(
        db,
        "patient_created",
        patient_id=patient.id,
        note=f"{patient.name} registered (severity {patient.severity}, urgency {patient.urgency_score}) needing a {patient.resource_type_needed}.",
    )
    if status == "waiting":
        event_repo.add_event(
            db,
            "patient_waiting",
            patient_id=patient.id,
            note=f"{patient.name} joined the waiting queue.",
        )
        matching_service.record_trigger(db, patient.resource_type_needed)
    elif status == "en_route":
        event_repo.add_event(
            db,
            "ambulance_en_route",
            patient_id=patient.id,
            note=f"{patient.name} incoming via ambulance {patient.ambulance_id} (ETA {patient.eta_minutes} min).",
        )

    db.commit()
    db.refresh(patient)
    return patient


def list_waiting(db: Session):
    return patient_repo.list_waiting(db)


def list_patients(db: Session, status: Optional[str] = None):
    patients = patient_repo.list_patients(db, status)
    # inject computed waiting_minutes
    for p in patients:
        setattr(p, "waiting_minutes", waiting_minutes(p))
    return patients


def get_patient(db: Session, patient_id: int):
    patient = patient_repo.get_patient(db, patient_id)
    if patient is None:
        raise NotFoundError(f"Patient {patient_id} was not found.")
    setattr(patient, "waiting_minutes", waiting_minutes(patient))
    return patient


def get_history(db: Session, patient_id: int):
    get_patient(db, patient_id)  # 404 if missing
    return event_repo.list_for_patient(db, patient_id)


def update_status(
    db: Session,
    patient_id: int,
    new_status: str,
    staff_name: Optional[str] = None,
    reason: Optional[str] = None,
):
    patient = get_patient(db, patient_id)
    try:
        assert_patient_transition(patient.status, new_status)
    except ValueError as e:
        raise ConflictError(str(e))

    old_status = patient.status
    patient.status = new_status
    event_repo.add_event(
        db,
        f"patient_{new_status}",
        patient_id=patient.id,
        resource_id=patient.current_resource_id,
        note=reason or f"Patient status changed from {old_status} to {new_status}.",
    )
    db.commit()
    db.refresh(patient)
    return patient


def discharge(
    db: Session,
    patient_id: int,
    staff_name: Optional[str] = None,
    reason: Optional[str] = None,
):
    """Discharge a patient, release linked resource, trigger matching."""
    patient = get_patient(db, patient_id)
    if patient.status == "discharged":
        raise ConflictError(f"{patient.name} is already discharged.")

    resource = None
    if patient.current_resource_id is not None:
        resource = resource_repo.get_resource(db, patient.current_resource_id)

    if resource is not None and resource.status in ["committed", "reserved"]:
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
        note=reason or f"{patient.name} discharged.",
    )
    if resource is not None:
        matching_service.record_trigger(db, resource.type)
    db.commit()
    db.refresh(patient)
    return patient


def transfer(db: Session, patient_id: int, target_resource_id: int):
    """Step a patient down the care path (ICU -> ward, theatre -> ICU)."""
    patient = get_patient(db, patient_id)
    if patient.status not in ["admitted", "discharge_pending"] or patient.current_resource_id is None:
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

    if not resource_repo.try_commit(db, target.id, patient_id=patient.id):
        db.rollback()
        raise ConflictError(
            f"{target.name} was committed by another request. Transfer rejected (409 conflict)."
        )

    patient.current_resource_id = target.id
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
