"""Service layer: resource queries, manual status changes, release."""
from typing import List, Optional

from sqlalchemy.orm import Session

from backend.domain import state_machine
from backend.errors import ConflictError, NotFoundError, UnprocessableError
from backend.repositories import event_repository as event_repo
from backend.repositories import patient_repository as patient_repo
from backend.repositories import resource_repository as resource_repo
from backend.services import matching_service


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
