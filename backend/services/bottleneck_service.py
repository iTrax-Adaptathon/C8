"""Service layer: Operational bottleneck detection and critical alerts."""
from datetime import timedelta
from typing import List

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.domain.matching_engine import waiting_minutes
from backend.models.db_models import Ambulance, Patient, Resource, TheatreBooking, utcnow
from backend.schemas.pydantic_schemas import BottleneckOut


def detect_bottlenecks(db: Session) -> List[BottleneckOut]:
    alerts: List[BottleneckOut] = []
    now = utcnow()

    # 1. Incoming Critical Ambulances
    stmt_amb = select(Ambulance).where(Ambulance.status == "En Route")
    en_route_amb = list(db.scalars(stmt_amb))
    critical_amb = [a for a in en_route_amb if a.severity == "Critical"]
    for a in critical_amb:
        alerts.append(
            BottleneckOut(
                id=f"amb-{a.id}",
                title=f"Critical Patient Arriving (Ambulance {a.ambulance_code})",
                detail=f"ETA {a.eta_minutes} min requiring {a.required_resource}. Immediate bed readiness needed.",
                severity="Critical",
                category="ambulance",
            )
        )

    # 2. Bed Capacity: ICU and Emergency/Ward
    stmt_beds = select(Resource).where(Resource.type == "bed")
    all_beds = list(db.scalars(stmt_beds))
    icu_beds = [b for b in all_beds if "ICU" in b.name or (b.department and "ICU" in b.department.upper())]
    icu_available = [b for b in icu_beds if b.status == "available"]

    stmt_waiting = select(Patient).where(Patient.status.in_(["waiting", "en_route"]))
    active_patients = list(db.scalars(stmt_waiting))
    critical_waiting = [p for p in active_patients if p.severity in ["Critical", "High"] and p.resource_type_needed == "bed"]

    if len(icu_available) == 0 and len(critical_waiting) > 0:
        alerts.append(
            BottleneckOut(
                id="icu-capacity-zero",
                title="No ICU Beds Available",
                detail=f"0 available out of {len(icu_beds)} ICU beds while {len(critical_waiting)} critical patient(s) waiting.",
                severity="Critical",
                category="bed",
            )
        )
    elif len(icu_available) <= 1 and len(critical_waiting) >= 2:
        alerts.append(
            BottleneckOut(
                id="icu-capacity-tight",
                title="ICU Bed Pressure",
                detail=f"Only {len(icu_available)} ICU bed available with {len(critical_waiting)} high-acuity patients queued.",
                severity="High",
                category="bed",
            )
        )

    # 3. Staff Shortage / Qualification Check
    stmt_staff = select(Resource).where(Resource.type == "staff")
    all_staff = list(db.scalars(stmt_staff))
    avail_staff = [s for s in all_staff if getattr(s, "availability", "available") == "available" and s.status == "available"]
    
    # Check if ICU beds exist but no available ICU-qualified staff
    icu_staff = [s for s in avail_staff if "ICU" in (s.department or "").upper() or "ICU" in (s.role or "").upper()]
    if len(icu_available) > 0 and len(icu_staff) == 0:
        alerts.append(
            BottleneckOut(
                id="staff-icu-shortage",
                title="Staff Shortage: ICU Qualified",
                detail="ICU bed is available, but no ICU-qualified staff currently available on shift.",
                severity="High",
                category="staff",
            )
        )

    if len(avail_staff) <= 2:
        alerts.append(
            BottleneckOut(
                id="staff-low",
                title="Hospital-wide Staff Shortage",
                detail=f"Only {len(avail_staff)} staff units available across active departments.",
                severity="High",
                category="staff",
            )
        )

    # 4. Long Waiting Time Detection
    for p in active_patients:
        mins = waiting_minutes(p, now)
        if p.severity == "Critical" and mins >= 15:
            alerts.append(
                BottleneckOut(
                    id=f"wait-crit-{p.id}",
                    title=f"Excessive Wait: {p.name} (Critical)",
                    detail=f"Critical patient has been waiting {mins} minutes for {p.resource_type_needed}.",
                    severity="Critical",
                    category="wait_time",
                )
            )
        elif mins >= 60:
            alerts.append(
                BottleneckOut(
                    id=f"wait-long-{p.id}",
                    title=f"Long Wait Time: {p.name}",
                    detail=f"Patient in queue for {mins} minutes needing {p.resource_type_needed}.",
                    severity="Medium",
                    category="wait_time",
                )
            )

    # 5. Theatre Schedule Conflicts / Capacity
    stmt_theatres = select(Resource).where(Resource.type == "theatre")
    theatres = list(db.scalars(stmt_theatres))
    avail_theatres = [t for t in theatres if t.status == "available"]
    theatre_waiting = [p for p in active_patients if p.resource_type_needed == "theatre"]
    if len(avail_theatres) == 0 and len(theatre_waiting) > 0:
        alerts.append(
            BottleneckOut(
                id="theatre-full",
                title="Theatres Fully Occupied",
                detail=f"All {len(theatres)} surgical suites committed or in procedure with {len(theatre_waiting)} patient(s) waiting.",
                severity="High",
                category="theatre",
            )
        )

    return alerts
