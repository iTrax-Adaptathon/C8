"""Service layer: atomic allocation / release orchestration.

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


def allocate(
    db: Session, resource_id: int, patient_id: Optional[int] = None
) -> Dict:
    """Race-proof allocation.

    1. Optional fast pre-checks for a clear error message.
    2. One atomic conditional UPDATE (WHERE status='available').
    3. rowcount == 1 -> commit state + audit events together.
       rowcount == 0 -> another request won; raise 409, never fail silently.
    """
    resource = resource_repo.get_resource(db, resource_id)
    if resource is None:
        raise NotFoundError(f"Resource {resource_id} was not found.")
    if resource.status != "available":
        raise ConflictError(
            f"{resource.name} is already committed. Allocation rejected."
        )

    if patient_id is not None:
        patient = patient_repo.get_patient(db, patient_id)
        if patient is None:
            raise NotFoundError(f"Patient {patient_id} was not found.")
        if patient.status != "waiting":
            raise ConflictError(
                f"{patient.name} is '{patient.status}', not waiting. Allocation rejected."
            )
        if patient.resource_type_needed != resource.type:
            raise UnprocessableError(
                f"{resource.name} is a {resource.type}, but {patient.name} needs a "
                f"{patient.resource_type_needed}."
            )
    else:
        candidates = patient_repo.list_waiting_by_type(db, resource.type)
        if not candidates:
            raise UnprocessableError(
                f"No waiting patient requires a {resource.type}."
            )
        patient = candidates[0]

    # --- atomic, single-statement commitment ---
    committed = resource_repo.try_commit(db, resource_id)
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
        note=f"{resource.name} committed to {patient.name} "
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
    """Release a committed resource back to available (AC-7).

    History is never deleted - a release appends new events and may trigger
    a fresh matching recommendation.
    """
    resource = resource_repo.get_resource(db, resource_id)
    if resource is None:
        raise NotFoundError(f"Resource {resource_id} was not found.")
    if resource.status != "committed":
        raise ConflictError(f"{resource.name} is not currently committed.")

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


def auto_allocate_waiting(db: Session) -> Dict:
    """Allocate every waiting patient that has a compatible available resource.

    Powers the "Automatic" allocation mode: new arrivals and the existing
    waiting queue are both drained, best match first (urgency, then wait).
    Safe to call repeatedly - it is a no-op once the queue or free resources
    run out.
    """
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
