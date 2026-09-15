"""Service layer: matching orchestration and trigger points."""
from typing import List

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.domain import matching_engine
from backend.models.db_models import Patient
from backend.repositories import event_repository as event_repo
from backend.repositories import patient_repository as patient_repo
from backend.repositories import resource_repository as resource_repo


def get_recommendations(db: Session) -> List[dict]:
    """Live, side-effect-free recommendations for the UI match panel."""
    resources = resource_repo.list_resources(db)
    stmt = (
        select(Patient)
        .where(Patient.status.in_(["waiting", "arrived", "en_route"]))
        .order_by(Patient.urgency_score.desc(), Patient.waiting_since.asc(), Patient.id.asc())
    )
    queue = list(db.scalars(stmt))
    return matching_engine.build_recommendations(resources, queue)


def record_trigger(db: Session, resource_type: str) -> None:
    """Matching trigger: append a `match_recommended` event when a new
    recommendation becomes available for this resource type.
    """
    resource = resource_repo.first_available(db, resource_type)
    if resource is None:
        return
    queue = patient_repo.list_waiting_by_type(db, resource_type)
    if not queue:
        return
    patient = queue[0]

    latest = event_repo.latest_for_resource(db, resource.id)
    if (
        latest is not None
        and latest.event_type == "match_recommended"
        and latest.patient_id == patient.id
    ):
        return

    all_resources = resource_repo.list_resources(db)
    reasons = matching_engine.build_reasons(resource, patient, queue, all_resources)
    note = " | ".join(f"{r['label']}: {r['detail']}" for r in reasons)
    event_repo.add_event(
        db,
        "match_recommended",
        patient_id=patient.id,
        resource_id=resource.id,
        note=note,
    )
