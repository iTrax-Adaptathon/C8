"""Service layer: Ambulance incoming tracking, capacity check for ETA, and reservations."""
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.errors import ConflictError, NotFoundError, UnprocessableError
from backend.models.db_models import Ambulance, Patient, Resource, utcnow
from backend.repositories import event_repository as event_repo
from backend.repositories import resource_repository as resource_repo
from backend.schemas.pydantic_schemas import AmbulanceCreate
from backend.services import allocation_service


def list_ambulances(db: Session, status: Optional[str] = None) -> List[Ambulance]:
    stmt = select(Ambulance)
    if status:
        stmt = stmt.where(Ambulance.status == status)
    return list(db.scalars(stmt.order_by(Ambulance.eta_minutes.asc())))


def get_ambulance(db: Session, ambulance_id: int) -> Ambulance:
    amb = db.get(Ambulance, ambulance_id)
    if amb is None:
        raise NotFoundError(f"Ambulance {ambulance_id} was not found.")
    return amb


def check_resource_availability_for_eta(
    db: Session, required_resource: str, eta_minutes: int
) -> dict:
    """Check whether a suitable resource is available now or expected to be ready before ETA."""
    resource_type = "bed" if "bed" in required_resource.lower() or "icu" in required_resource.lower() else "theatre"
    
    # Check immediate available resources
    available_resources = resource_repo.list_available(db, resource_type)
    
    # Filter by ICU if required
    is_icu = "icu" in required_resource.lower()
    if is_icu:
        matching = [r for r in available_resources if "ICU" in r.name or (r.department and "ICU" in r.department.upper())]
    else:
        matching = available_resources

    if matching:
        return {
            "available": True,
            "expected_ready": True,
            "candidate_resource": matching[0].name,
            "message": f"Resource available immediately ({matching[0].name}) before ETA {eta_minutes} min.",
        }

    # Check if any patient is in discharge_pending
    stmt = select(Patient).where(Patient.status == "discharge_pending", Patient.resource_type_needed == resource_type)
    pending_discharge = list(db.scalars(stmt))
    if pending_discharge:
        return {
            "available": False,
            "expected_ready": True,
            "message": f"Bed currently occupied, but 1 patient is in Discharge Pending (likely ready within {eta_minutes} min).",
        }

    return {
        "available": False,
        "expected_ready": False,
        "message": f"No {required_resource} currently available for arrival in {eta_minutes} min.",
    }


def create_ambulance(db: Session, data: AmbulanceCreate) -> Ambulance:
    # 1. Create corresponding incoming Patient record with status 'en_route'
    patient_name = data.patient_name or f"Patient {data.ambulance_code}"
    resource_type = "bed" if "bed" in data.required_resource.lower() or "icu" in data.required_resource.lower() else "theatre"
    urgency_map = {"Critical": 9, "High": 7, "Medium": 5, "Low": 3}
    urgency = urgency_map.get(data.severity, 5)

    patient = Patient(
        name=patient_name,
        status="en_route",
        resource_type_needed=resource_type,
        urgency_score=urgency,
        severity=data.severity,
        department="ICU" if "icu" in data.required_resource.lower() else "Emergency",
        ambulance_id=data.ambulance_code,
        eta_minutes=data.eta_minutes,
        waiting_since=utcnow(),
    )
    db.add(patient)
    db.flush()

    ambulance = Ambulance(
        ambulance_code=data.ambulance_code,
        eta_minutes=data.eta_minutes,
        severity=data.severity,
        required_resource=data.required_resource,
        status="En Route",
        patient_id=patient.id,
    )
    db.add(ambulance)
    db.flush()

    event_repo.add_event(
        db,
        "ambulance_en_route",
        patient_id=patient.id,
        note=f"Ambulance {ambulance.ambulance_code} en route with {patient.name} "
        f"(Severity: {ambulance.severity}, ETA: {ambulance.eta_minutes} min, Needed: {ambulance.required_resource}).",
    )

    db.commit()
    db.refresh(ambulance)
    return ambulance


def reserve_for_ambulance(db: Session, ambulance_id: int, resource_id: int, staff_name: str = "Control Desk") -> Ambulance:
    ambulance = get_ambulance(db, ambulance_id)
    if ambulance.status != "En Route":
        raise ConflictError(f"Cannot reserve resource for ambulance with status '{ambulance.status}'.")

    if not ambulance.patient_id:
        raise UnprocessableError("Ambulance does not have an associated patient.")

    # Call atomic reservation
    allocation_service.reserve(
        db,
        resource_id=resource_id,
        patient_id=ambulance.patient_id,
        staff_name=staff_name,
        reason=f"Pre-reserved for incoming ambulance {ambulance.ambulance_code} (ETA {ambulance.eta_minutes}m).",
    )

    ambulance.reserved_resource_id = resource_id
    db.commit()
    db.refresh(ambulance)
    return ambulance


def mark_arrived(db: Session, ambulance_id: int) -> Ambulance:
    ambulance = get_ambulance(db, ambulance_id)
    if ambulance.status != "En Route":
        raise ConflictError(f"Ambulance {ambulance.ambulance_code} is already {ambulance.status}.")

    ambulance.status = "Arrived"
    ambulance.eta_minutes = 0

    if ambulance.patient_id:
        patient = db.get(Patient, ambulance.patient_id)
        if patient:
            # If patient had a reserved resource, keep it as reserved, else waiting
            if patient.current_resource_id and patient.status == "reserved":
                patient.status = "reserved"
            else:
                patient.status = "waiting"
            event_repo.add_event(
                db,
                "ambulance_arrived",
                patient_id=patient.id,
                resource_id=patient.current_resource_id,
                note=f"Ambulance {ambulance.ambulance_code} arrived. {patient.name} transitioned to {patient.status}.",
            )

    db.commit()
    db.refresh(ambulance)
    return ambulance


def cancel_ambulance(db: Session, ambulance_id: int, reason: Optional[str] = None) -> Ambulance:
    ambulance = get_ambulance(db, ambulance_id)
    if ambulance.status == "Cancelled":
        raise ConflictError(f"Ambulance {ambulance.ambulance_code} is already cancelled.")

    ambulance.status = "Cancelled"

    # If ambulance had a pre-reserved resource, release it back to available
    if ambulance.reserved_resource_id:
        try:
            allocation_service.cancel_reservation(
                db,
                ambulance.reserved_resource_id,
                reason=f"Released due to cancellation of Ambulance {ambulance.ambulance_code}.",
            )
        except Exception:
            pass
        ambulance.reserved_resource_id = None

    if ambulance.patient_id:
        patient = db.get(Patient, ambulance.patient_id)
        if patient and patient.status in ["en_route", "reserved", "waiting"]:
            patient.status = "discharged"
            patient.current_resource_id = None

    event_repo.add_event(
        db,
        "ambulance_cancelled",
        patient_id=ambulance.patient_id,
        note=reason or f"Ambulance {ambulance.ambulance_code} cancelled.",
    )

    db.commit()
    db.refresh(ambulance)
    return ambulance
