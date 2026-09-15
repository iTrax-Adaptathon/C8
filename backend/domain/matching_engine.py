"""Domain layer: deterministic, explainable matching rules.

Pure functions over patient/resource objects considering:
- Patient severity & urgency
- Waiting time
- Required resource & compatibility
- Qualified staff availability
- ETA for incoming ambulance
- Theatre availability & schedule
"""
from datetime import datetime
from typing import Dict, List, Optional

from backend.models.db_models import Patient, Resource, utcnow


def waiting_minutes(patient: Patient, now: Optional[datetime] = None) -> int:
    now = now or utcnow()
    delta = now - patient.waiting_since
    return max(0, int(delta.total_seconds() // 60))


def is_compatible(resource: Resource, patient: Patient) -> bool:
    """Check clinical compatibility between resource and patient requirements."""
    if patient.resource_type_needed != resource.type:
        return False

    # Bed department checks: if patient needs ICU bed, ward bed is not compatible
    p_dep = (patient.department or "").upper()
    p_req = (patient.resource_type_needed or "").lower()
    r_name = resource.name.upper()

    if "ICU" in p_dep or "ICU" in (patient.specialty_needed or "").upper():
        if resource.type == "bed" and "ICU" not in r_name and (resource.department or "").upper() != "ICU":
            return False

    return True


def check_qualified_staff(
    resource: Resource, patient: Patient, all_resources: Optional[List[Resource]] = None
) -> Dict[str, any]:
    """Check if qualified staff is currently available for this allocation."""
    if not all_resources:
        return {"available": True, "detail": "Staff available on unit."}

    staff_pool = [
        r for r in all_resources if r.type == "staff" and getattr(r, "availability", "available") == "available"
    ]

    needed_dep = (patient.department or ("ICU" if "ICU" in resource.name else "Ward")).upper()
    matching_staff = [
        s for s in staff_pool if needed_dep in (s.department or "").upper() or needed_dep in (s.role or "").upper()
    ]

    if matching_staff:
        lead = matching_staff[0]
        role_label = getattr(lead, "role", "Staff")
        return {"available": True, "detail": f"Required staff available ({role_label}: {lead.name})."}

    if staff_pool:
        return {"available": True, "detail": f"General clinical staff available ({staff_pool[0].name})."}

    return {"available": False, "detail": "Warning: Limited staff availability for this unit."}


def build_reasons(
    resource: Resource,
    patient: Patient,
    queue: List[Patient],
    all_resources: Optional[List[Resource]] = None,
) -> List[Dict[str, str]]:
    """Explain *why* this patient was recommended for this resource.

    Provides explainable checklist recommendations covering:
    ✓ Suitable for requirement
    ✓ Available before ambulance ETA
    ✓ No conflicting reservation
    ✓ Required staff available
    """
    same_type = [
        p
        for p in queue
        if p.status in ["waiting", "en_route", "arrived"] and p.resource_type_needed == resource.type
    ]
    top_urgency = max((p.urgency_score for p in same_type), default=patient.urgency_score)
    urgency_is_top = patient.urgency_score >= top_urgency
    minutes = waiting_minutes(patient)

    urgency_detail = f"Urgency score {patient.urgency_score} ({patient.severity or 'Medium'})"
    if urgency_is_top:
        urgency_detail += " - highest in the queue"

    tie_count = sum(1 for p in same_type if p.urgency_score == patient.urgency_score)
    if urgency_is_top and tie_count > 1:
        urgency_detail += " (tied on urgency, prioritised on wait time)"

    staff_check = check_qualified_staff(resource, patient, all_resources)

    # Ambulance ETA check
    if patient.eta_minutes is not None and patient.eta_minutes > 0:
        eta_text = f"✓ Available before ambulance ETA ({patient.eta_minutes} min arrival window)."
    else:
        eta_text = "✓ Immediate bed availability ready for patient."

    return [
        {
            "label": f"{resource.type.title()} compatible",
            "detail": f"✓ Suitable for {patient.name} ({patient.resource_type_needed.upper()} requirement).",
        },
        {"label": "Highest urgency", "detail": f"✓ {urgency_detail}."},
        {"label": "Longest wait", "detail": f"✓ In queue {minutes} minute(s)."},
        {
            "label": "Resource available",
            "detail": f"✓ {resource.name} is currently available.",
        },
        {
            "label": "No conflicting reservation",
            "detail": "✓ No conflicting reservation on this resource.",
        },
        {
            "label": "Ambulance ETA compatible",
            "detail": eta_text,
        },
        {
            "label": "Required staff available",
            "detail": f"✓ {staff_check['detail']}",
        },
    ]


def recommend_for_resource(
    resource: Resource,
    queue: List[Patient],
    exclude_ids: Optional[set] = None,
    all_resources: Optional[List[Resource]] = None,
) -> Optional[Dict]:
    """Return the best eligible patient for one resource, with explainable reasons."""
    exclude_ids = exclude_ids or set()
    for patient in queue:
        if patient.status not in ["waiting", "en_route", "arrived"] or patient.id in exclude_ids:
            continue
        if not is_compatible(resource, patient):
            continue

        return {
            "resource_id": resource.id,
            "resource_name": resource.name,
            "resource_type": resource.type,
            "patient_id": patient.id,
            "patient_name": patient.name,
            "urgency_score": patient.urgency_score,
            "waiting_minutes": waiting_minutes(patient),
            "severity": getattr(patient, "severity", "Medium"),
            "reasons": build_reasons(resource, patient, queue, all_resources),
        }
    return None


def build_recommendations(
    resources: List[Resource],
    queue: List[Patient],
    theatre_bookings: Optional[List] = None,
) -> List[Dict]:
    """Greedy: each available resource gets the top unused compatible patient."""
    used: set = set()
    recommendations: List[Dict] = []
    available = sorted(
        (r for r in resources if r.status == "available"), key=lambda r: (r.type, r.name)
    )
    for resource in available:
        rec = recommend_for_resource(resource, queue, exclude_ids=used, all_resources=resources)
        if rec:
            recommendations.append(rec)
            used.add(rec["patient_id"])
    return recommendations
