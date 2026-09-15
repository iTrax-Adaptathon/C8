"""Service layer: resource queries, manual status changes, release."""
from typing import List, Optional

from sqlalchemy.orm import Session

from backend.domain import state_machine
from backend.errors import ConflictError, NotFoundError, UnprocessableError
from backend.repositories import event_repository as event_repo
from backend.repositories import patient_repository as patient_repo
from backend.repositories import resource_repository as resource_repo
from backend.services import matching_service
from backend.models.db_models import Resource


def create_resources(db: Session, data):
    """Add capacity units without changing existing allocations."""
    resources = []
    for index in range(data.quantity):
        name = data.name.strip() if data.quantity == 1 else f"{data.name.strip()} {index + 1}"
        resource = Resource(
            type=data.type,
            name=name,
            status="available",
            department=data.department,
            specialty=data.specialty,
            role=data.role,
            shift=data.shift,
            availability="available" if data.type == "staff" else None,
        )
        db.add(resource)
        resources.append(resource)
    db.flush()
    for resource in resources:
        event_repo.add_event(
            db,
            "resource_created",
            resource_id=resource.id,
            actor="Capacity Manager",
            reason=f"Added {data.type} capacity.",
            note=f"{resource.name} added to available {data.type} capacity.",
        )
    db.commit()
    for resource in resources:
        db.refresh(resource)
    return resources


def remove_resource(db: Session, resource_id: int):
    """Remove only unused capacity so active assignments cannot disappear."""
    resource = get_resource(db, resource_id)
    if resource.status != "available":
        raise ConflictError(f"{resource.name} is {resource.status}; only available capacity can be removed.")
    if patient_repo.get_by_current_resource(db, resource_id) is not None:
        raise ConflictError(f"{resource.name} is assigned to a patient and cannot be removed.")
    event_repo.add_event(
        db,
        "resource_removed",
        resource_id=resource.id,
        actor="Capacity Manager",
        reason="Capacity reduced by operator.",
        note=f"{resource.name} removed from available capacity.",
    )
    resource.active = False
    db.commit()


def list_resources(db: Session):
    return resource_repo.list_resources(db)


def get_resource(db: Session, resource_id: int):
    resource = resource_repo.get_resource(db, resource_id)
    if resource is None:
        raise NotFoundError(f"Resource {resource_id} was not found.")
    return resource


def update_status(
    db: Session, resource_id: int, new_status: str, note: Optional[str] = None
):
    """Manual PATCH available <-> committed. May trigger matching."""
    resource = get_resource(db, resource_id)
    if resource.status == new_status:
        return resource

    try:
        state_machine.assert_resource_transition(resource.status, new_status)
    except state_machine.TransitionError as exc:
        raise UnprocessableError(str(exc)) from exc

    if new_status == "committed":
        committed = resource_repo.try_commit(db, resource_id)
        if not committed:
            db.rollback()
            raise ConflictError(f"{resource.name} was committed by another request.")
        event_repo.add_event(
            db,
            "resource_committed",
            resource_id=resource_id,
            note=note or f"{resource.name} manually marked committed.",
        )
    else:  # committed -> available
        released = resource_repo.try_release(db, resource_id)
        if not released:
            db.rollback()
            raise ConflictError(f"{resource.name} was released by another request.")
        patient = patient_repo.get_by_current_resource(db, resource_id)
        if patient is not None:
            patient.status = "waiting"
            patient.current_resource_id = None
            event_repo.add_event(
                db,
                "patient_waiting",
                patient_id=patient.id,
                resource_id=resource_id,
                note=f"{patient.name} returned to the waiting queue.",
            )
        event_repo.add_event(
            db,
            "resource_released",
            resource_id=resource_id,
            note=note or f"{resource.name} manually marked available.",
        )
        matching_service.record_trigger(db, resource.type)

    db.commit()
    db.refresh(resource)
    return resource
