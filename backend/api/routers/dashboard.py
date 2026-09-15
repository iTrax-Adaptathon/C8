"""Router: /dashboard endpoints powering the streamlined, uncluttered control center."""
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.domain.matching_engine import waiting_minutes
from backend.models.db_models import Ambulance, Patient, Resource
from backend.schemas.pydantic_schemas import DashboardSummaryOut
from backend.services import ambulance_service, bottleneck_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummaryOut)
def get_dashboard_summary(db: Session = Depends(get_db)):
    # 1. Beds summary
    stmt_beds = select(Resource).where(Resource.active.is_(True), Resource.type == "bed")
    beds = list(db.scalars(stmt_beds))
    beds_total = len(beds)
    beds_available = sum(1 for b in beds if b.status == "available")

    # 2. Staff summary
    stmt_staff = select(Resource).where(Resource.active.is_(True), Resource.type == "staff")
    staff_members = list(db.scalars(stmt_staff))
    staff_total = len(staff_members)
    staff_available = sum(
        1 for s in staff_members if getattr(s, "availability", "available") == "available" and s.status == "available"
    )

    # 3. Incoming ambulances (En Route)
    stmt_amb = select(Ambulance).where(Ambulance.status == "En Route").order_by(Ambulance.eta_minutes.asc())
    en_route_ambulances = list(db.scalars(stmt_amb))
    ambulances_en_route_count = len(en_route_ambulances)

    # 4. Bottlenecks & Alerts
    alerts = bottleneck_service.detect_bottlenecks(db)
    critical_bottlenecks_count = sum(1 for a in alerts if a.severity in ["Critical", "High"])

    # 5. Patient Flow Stage Counts: En Route -> Waiting -> Reserved -> Admitted -> Discharge Pending
    # Query patient counts grouped by status
    stmt_flow = select(Patient.status, func.count(Patient.id)).group_by(Patient.status)
    flow_counts = dict(db.execute(stmt_flow).all())
    
    patient_flow = {
        "en_route": ambulances_en_route_count,  # matches incoming active count
        "waiting": flow_counts.get("waiting", 0) + flow_counts.get("arrived", 0),
        "reserved": flow_counts.get("reserved", 0),
        "admitted": flow_counts.get("admitted", 0),
        "discharge_pending": flow_counts.get("discharge_pending", 0),
    }

    # 6. Recent Patients (top 8 recent active or updated)
    stmt_recent = (
        select(Patient)
        .where(Patient.status != "discharged")
        .order_by(Patient.urgency_score.desc(), Patient.waiting_since.asc())
        .limit(8)
    )
    recent_patients = list(db.scalars(stmt_recent))
    for p in recent_patients:
        setattr(p, "waiting_minutes", waiting_minutes(p))

    return DashboardSummaryOut(
        beds_available=beds_available,
        beds_total=beds_total,
        staff_available=staff_available,
        staff_total=staff_total,
        ambulances_en_route=ambulances_en_route_count,
        critical_bottlenecks=critical_bottlenecks_count,
        patient_flow=patient_flow,
        incoming_ambulances=en_route_ambulances,
        alerts=alerts,
        recent_patients=recent_patients,
    )
