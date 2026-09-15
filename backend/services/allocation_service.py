"""Service layer: atomic allocation, reservation, and release orchestration.

The state change and its audit event are written in the SAME transaction.
"""
from typing import Dict, Optional

from sqlalchemy.orm import Session

from backend.domain import matching_engine
from backend.errors import ConflictError, NotFoundError, UnprocessableError
from backend.repositories import event_repository as event_repo
from backend.repositories import patient_repository as patient_repo
from backend.repositories import resource_repository as resource_repo
from backend.services import matching_service


def reserve(
    db: Session,
    resource_id: int,
    patient_id: int,
    staff_name: Optional[str] = None,
    reason: Optional[str] = None,
) -> Dict:
    """Race-proof reservation: Available -> Reserved.

    Guarantees a resource cannot be reserved by two requests simultaneously.
    """
    resource = resource_repo.get_resource(db, resource_id)
    if resource is None:
        raise NotFoundError(f"Resource {resource_id} was not found.")
    if resource.status != "available":
        raise ConflictError(
            f"{resource.name} is currently '{resource.status}', not available for reservation."
        )

    patient = patient_repo.get_patient(db, patient_id)
    if patient is None:
        raise NotFoundError(f"Patient {patient_id} was not found.")
    if patient.status not in ["waiting", "en_route", "arrived"]:
        raise ConflictError(
            f"{patient.name} is '{patient.status}', cannot reserve a resource."
        )
    if patient.resource_type_needed != resource.type:
        raise UnprocessableError(
            f"{resource.name} is a {resource.type}, but {patient.name} needs a "
            f"{patient.resource_type_needed}."
        )

    reserved = resource_repo.try_reserve(db, resource_id, patient_id)
    if not reserved:
        db.rollback()
        raise ConflictError(
            f"{resource.name} was reserved by another request. Reservation rejected (409 conflict)."
        )

    patient.status = "reserved"
    patient.current_resource_id = resource_id

    event_repo.add_event(
        db,
        "resource_reserved",
        patient_id=patient.id,
        resource_id=resource.id,
        note=reason or f"{resource.name} reserved for {patient.name} ({patient.severity}).",
    )
    event_repo.add_event(
        db,
        "patient_reserved",
        patient_id=patient.id,
        resource_id=resource.id,
        note=f"{patient.name} status updated to reserved on {resource.name}.",
    )
    db.commit()
    db.refresh(resource)
    db.refresh(patient)

    return {
        "resource": resource,
        "patient": patient,
        "message": f"{resource.name} reserved for {patient.name}.",
    }


def cancel_reservation(
    db: Session,
    resource_id: int,
    staff_name: Optional[str] = None,
    reason: Optional[str] = None,
) -> Dict:
    """Cancel a reservation and release the resource back to available."""
    resource = resource_repo.get_resource(db, resource_id)
    if resource is None:
        raise NotFoundError(f"Resource {resource_id} was not found.")
    if resource.status != "reserved":
        raise ConflictError(f"{resource.name} is not currently reserved.")

    patient_id = resource.reserved_for_patient_id
    patient = patient_repo.get_patient(db, patient_id) if patient_id else None

    cancelled = resource_repo.try_cancel_reservation(db, resource_id)
    if not cancelled:
        db.rollback()
        raise ConflictError(f"Could not cancel reservation on {resource.name}.")

    if patient is not None and patient.status == "reserved":
        # Return to en_route if was ambulance, else waiting
        patient.status = "en_route" if patient.ambulance_id else "waiting"
        patient.current_resource_id = None
        event_repo.add_event(
            db,
            "patient_waiting",
            patient_id=patient.id,
            resource_id=resource.id,
            note=f"{patient.name} returned to {patient.status} after reservation cancellation.",
        )

    event_repo.add_event(
        db,
        "reservation_cancelled",
        patient_id=patient.id if patient else None,
        resource_id=resource.id,
        note=reason or f"Reservation for {resource.name} was cancelled.",
    )
    matching_service.record_trigger(db, resource.type)
    db.commit()
    db.refresh(resource)
    if patient:
        db.refresh(patient)

    return {
        "resource": resource,
        "patient": patient,
        "message": f"Reservation on {resource.name} cancelled.",
    }


def allocate(
    db: Session,
    resource_id: int,
    patient_id: Optional[int] = None,
    staff_name: Optional[str] = None,
    reason: Optional[str] = None,
) -> Dict:
    """Race-proof allocation / admission.

    Can commit an available resource, or confirm a pre-reserved resource.
    Guarantees no double-booking via single atomic conditional UPDATE.
    """
    resource = resource_repo.get_resource(db, resource_id)
    if resource is None:
        raise NotFoundError(f"Resource {resource_id} was not found.")
    if resource.status not in ["available", "reserved"]:
        raise ConflictError(
            f"{resource.name} is already committed. Allocation rejected."
        )

    if patient_id is not None:
        patient = patient_repo.get_patient(db, patient_id)
        if patient is None:
            raise NotFoundError(f"Patient {patient_id} was not found.")
        if patient.status not in ["waiting", "reserved", "arrived", "en_route"]:
            raise ConflictError(
                f"{patient.name} is '{patient.status}', not waiting/reserved. Allocation rejected."
            )
        if patient.resource_type_needed != resource.type:
            raise UnprocessableError(
                f"{resource.name} is a {resource.type}, but {patient.name} needs a "
                f"{patient.resource_type_needed}."
            )
        if (
            resource.status == "reserved"
            and resource.reserved_for_patient_id is not None
            and resource.reserved_for_patient_id != patient.id
        ):
            raise ConflictError(
                f"{resource.name} is reserved for a different patient."
            )
    else:
        candidates = patient_repo.list_waiting_by_type(db, resource.type)
        if not candidates:
            raise UnprocessableError(
                f"No waiting patient requires a {resource.type}."
            )
        patient = candidates[0]

    # --- atomic, single-statement commitment ---
    committed = resource_repo.try_commit(db, resource_id, patient_id=patient.id)
    if not committed:
        db.rollback()
        raise ConflictError(
            f"{resource.name} was committed by another request. "
            "Allocation rejected (409 conflict)."
        )

    wait = matching_engine.waiting_minutes(patient)
    patient.status = "admitted"
    patient.current_resource_id = resource_id

    event_repo.add_event(
        db,
        "resource_committed",
        patient_id=patient.id,
        resource_id=resource_id,
        note=reason or f"{resource.name} committed to {patient.name} "
        f"(urgency {patient.urgency_score}, waiting {wait} min).",
    )
    event_repo.add_event(
        db,
        "patient_admitted",
        patient_id=patient.id,
        resource_id=resource_id,
        note=f"{patient.name} admitted to {resource.name}.",
    )
    db.commit()
    db.refresh(resource)
    db.refresh(patient)

    return {
        "resource": resource,
        "patient": patient,
        "message": f"{patient.name} allocated to {resource.name}.",
    }


def release(db: Session, resource_id: int, note: Optional[str] = None):
    """Release a committed resource back to available."""
    resource = resource_repo.get_resource(db, resource_id)
    if resource is None:
        raise NotFoundError(f"Resource {resource_id} was not found.")
    if resource.status not in ["committed", "reserved"]:
        raise ConflictError(f"{resource.name} is not currently committed or reserved.")

    released = resource_repo.try_release(db, resource_id)
    if not released:
        db.rollback()
        raise ConflictError(f"{resource.name} was already released by another request.")

    patient = patient_repo.get_by_current_resource(db, resource_id)
    if patient is not None:
        patient.status = "waiting"
        patient.current_resource_id = None
        event_repo.add_event(
            db,
            "patient_waiting",
            patient_id=patient.id,
            resource_id=resource_id,
            note=f"{patient.name} returned to the waiting queue after release.",
        )
    event_repo.add_event(
        db,
        "resource_released",
        patient_id=patient.id if patient else None,
        resource_id=resource_id,
        note=note or f"{resource.name} released back to available.",
    )
    matching_service.record_trigger(db, resource.type)
    db.commit()
    db.refresh(resource)
    return resource


def mark_discharge_pending(
    db: Session,
    patient_id: int,
    staff_name: Optional[str] = None,
    reason: Optional[str] = None,
):
    """Transition admitted patient to discharge pending."""
    patient = patient_repo.get_patient(db, patient_id)
    if patient is None:
        raise NotFoundError(f"Patient {patient_id} was not found.")
    if patient.status != "admitted":
        raise ConflictError(f"{patient.name} is '{patient.status}', not admitted.")

    patient.status = "discharge_pending"
    event_repo.add_event(
        db,
        "discharge_pending",
        patient_id=patient.id,
        resource_id=patient.current_resource_id,
        note=reason or f"Discharge planning started for {patient.name}.",
    )
    db.commit()
    db.refresh(patient)
    return patient


def auto_allocate_waiting(db: Session) -> Dict:
    """Allocate waiting patients to compatible available resources."""
    targets = [
        (resource.id, resource.type) for resource in resource_repo.list_available(db)
    ]
    allocated = 0
    for resource_id, resource_type in targets:
        if not patient_repo.list_waiting_by_type(db, resource_type):
            continue
        try:
            allocate(db, resource_id)
        except (ConflictError, NotFoundError, UnprocessableError):
            continue
        allocated += 1
    return {
        "allocated": allocated,
        "message": f"Auto-allocated {allocated} waiting patient(s).",
    }
