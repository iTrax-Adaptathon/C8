"""Domain layer: deterministic, explainable matching rules.

Pure functions over patient/resource objects so the ranking rules are
readable and unit-testable without a database.
"""
from datetime import datetime
from typing import Dict, List, Optional

from backend.models.db_models import Patient, Resource, utcnow


def waiting_minutes(patient: Patient, now: Optional[datetime] = None) -> int:
    now = now or utcnow()
    delta = now - patient.waiting_since
    return max(0, int(delta.total_seconds() // 60))


def build_reasons(
    resource: Resource, patient: Patient, queue: List[Patient]
) -> List[Dict[str, str]]:
    """Explain *why* this patient was recommended for this resource (AC-4)."""
    same_type = [
        p for p in queue if p.status == "waiting" and p.resource_type_needed == resource.type
    ]
    top_urgency = max((p.urgency_score for p in same_type), default=patient.urgency_score)
    urgency_is_top = patient.urgency_score >= top_urgency
    minutes = waiting_minutes(patient)

    urgency_detail = f"Urgency score {patient.urgency_score}"
    if urgency_is_top:
        urgency_detail += " - highest in the queue"

    tie_count = sum(1 for p in same_type if p.urgency_score == patient.urgency_score)
    if urgency_is_top and tie_count > 1:
        urgency_detail += f" (tied on urgency, wins on wait time)"

    return [
        {
            "label": f"{resource.type.title()} compatible",
            "detail": f"{patient.name} needs a {patient.resource_type_needed} and {resource.name} is a {resource.type}.",
        },
        {"label": "Highest urgency", "detail": urgency_detail + "."},
        {"label": "Longest wait", "detail": f"Waiting {minutes} minute(s)."},
        {
            "label": "Resource available",
            "detail": f"{resource.name} is currently available.",
        },
    ]


def recommend_for_resource(
    resource: Resource, queue: List[Patient], exclude_ids: Optional[set] = None
) -> Optional[Dict]:
    """Return the best waiting patient for one resource, with reasons."""
    exclude_ids = exclude_ids or set()
    for patient in queue:
        if patient.status != "waiting" or patient.id in exclude_ids:
            continue
        if patient.resource_type_needed != resource.type:
            continue
        return {
            "resource_id": resource.id,
            "resource_name": resource.name,
            "resource_type": resource.type,
            "patient_id": patient.id,
            "patient_name": patient.name,
            "urgency_score": patient.urgency_score,
            "waiting_minutes": waiting_minutes(patient),
            "reasons": build_reasons(resource, patient, queue),
        }
    return None


def build_recommendations(
    resources: List[Resource], queue: List[Patient]
) -> List[Dict]:
    """Greedy: each available resource gets the top unused compatible patient.

    `queue` must already be ordered by urgency DESC then waiting_since ASC.
    """
    used: set = set()
    recommendations: List[Dict] = []
    available = sorted(
        (r for r in resources if r.status == "available"), key=lambda r: (r.type, r.name)
    )
    for resource in available:
        rec = recommend_for_resource(resource, queue, exclude_ids=used)
        if rec:
            recommendations.append(rec)
            used.add(rec["patient_id"])
    return recommendations
