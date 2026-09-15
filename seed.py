"""Reproducible demo seed for the MedFlow Hospital Capacity platform.

Usage:
    python seed.py

Wipes tables and recreates a known, realistic demo state:
  - 20 beds           (12 available / 8 committed)
  - 5 theatre slots   ( 3 available / 2 committed)
  - 10 staff units    ( 8 available / 2 committed)
  - 14 patients       ( 7 waiting / 4 admitted / 3 discharged)
  - 3 incoming ambulances (A102, A205, A311)
  - scheduled theatre bookings with conflict checking
  - a matching audit trail in `events`
"""
from datetime import timedelta

from backend.database import SessionLocal, drop_db, init_db
from backend.models.db_models import Ambulance, Event, Patient, Resource, TheatreBooking, utcnow


def _add_events(db, rows):
    db.add_all(rows)


def seed() -> dict:
    drop_db()
    init_db()

    db = SessionLocal()
    now = utcnow()
    try:
        # ---------------------------------------------------------------- resources
        beds = []
        for i in range(1, 21):
            if i <= 6:
                name = f"ICU B{100 + i}"
                dept = "ICU"
                spec = "Critical Care"
            elif i <= 12:
                name = f"Emergency B{100 + i}"
                dept = "Emergency"
                spec = "Emergency"
            else:
                name = f"Ward B{100 + i}"
                dept = "Ward"
                spec = "Internal Medicine"

            beds.append(
                Resource(
                    type="bed",
                    name=name,
                    status="available",
                    version=0,
                    updated_at=now,
                    department=dept,
                    specialty=spec,
                )
            )

        theatres = [
            Resource(
                type="theatre",
                name=f"Theatre T{i}",
                status="available",
                version=0,
                updated_at=now,
                department="Surgical",
                specialty="General Surgery" if i <= 3 else "Orthopaedics",
            )
            for i in range(1, 6)
        ]

        staff_profiles = [
            ("Dr. Priya Nair", "ICU Specialist", "Critical Care", "ICU", "Day Shift", "available", 2),
            ("Nurse Alex Reed", "ICU Nurse", "Critical Care", "ICU", "Day Shift", "available", 3),
            ("Dr. Marcus Vance", "Trauma Surgeon", "General Surgery", "Surgical", "Day Shift", "available", 1),
            ("Dr. Sarah Chen", "Anaesthetist", "Anaesthesia", "Surgical", "Day Shift", "available", 2),
            ("Nurse Elena Ward", "Triage Nurse", "Emergency", "Emergency", "Day Shift", "available", 4),
            ("Nurse John Miller", "Ward Nurse", "General", "Ward", "Day Shift", "available", 4),
            ("Nurse Rachel Green", "Ward Nurse", "General", "Ward", "Night Shift", "available", 0),
            ("Dr. David Kim", "Hospitalist", "Internal Medicine", "Ward", "Day Shift", "available", 3),
            ("Dr. Chloe Bennett", "Emergency Physician", "Emergency", "Emergency", "Day Shift", "busy", 5),
            ("Dr. Thomas Cole", "Orthopaedic Surgeon", "Orthopaedics", "Surgical", "On Call", "on_break", 0),
        ]

        staff = [
            Resource(
                type="staff",
                name=name,
                status="available",
                version=0,
                updated_at=now,
                role=role,
                specialty=spec,
                department=dept,
                shift=shift,
                availability=avail,
                workload=workload,
            )
            for name, role, spec, dept, shift, avail, workload in staff_profiles
        ]

        db.add_all(beds + theatres + staff)
        db.flush()

        committed_bed_idx = list(range(0, 8))       # 8 committed beds
        committed_theatre_idx = [0, 1]              # 2 committed theatres
        committed_staff_idx = [0, 1]                # 2 committed staff units
        for idx in committed_bed_idx:
            beds[idx].status = "committed"
            beds[idx].version = 1
        for idx in committed_theatre_idx:
            theatres[idx].status = "committed"
            theatres[idx].version = 1
        for idx in committed_staff_idx:
            staff[idx].status = "committed"
            staff[idx].version = 1
        db.flush()

        events = []

        def ev(event_type, patient=None, resource=None, note=None, minutes_ago=0, staff_name=None, reason=None):
            events.append(
                Event(
                    patient_id=patient.id if patient else None,
                    resource_id=resource.id if resource else None,
                    event_type=event_type,
                    note=note,
                    staff_name=staff_name,
                    reason=reason,
                    created_at=now - timedelta(minutes=minutes_ago),
                )
            )

        for idx in committed_bed_idx[3:]:
            ev("resource_committed", resource=beds[idx],
               note=f"{beds[idx].name} marked committed (occupied / awaiting cleaning).",
               minutes_ago=70)
        ev("resource_committed", resource=theatres[1],
           note=f"{theatres[1].name} blocked for maintenance.", minutes_ago=160)
        for idx in committed_staff_idx:
            ev("resource_committed", resource=staff[idx],
               note=f"{staff[idx].name} assigned to an active procedure.", minutes_ago=95)

        # ----------------------------------------------------------------- patients
        # waiting: (name, type, urgency, minutes_waiting, severity, dept)
        waiting_specs = [
            ("Aarav Sharma", "bed", 5, 95, "Critical", "ICU"),
            ("Priya Nair", "bed", 4, 70, "High", "Emergency"),
            ("Rohan Mehta", "bed", 4, 45, "High", "Ward"),
            ("Isla Fernandes", "bed", 3, 30, "Medium", "Ward"),
            ("Wei Chen", "theatre", 5, 120, "Critical", "Surgical"),
            ("Sofia Rossi", "theatre", 3, 60, "Medium", "Surgical"),
            ("Noah Williams", "staff", 4, 40, "High", "Emergency"),
        ]
        patients = []
        for name, rtype, urgency, waited, severity, dept in waiting_specs:
            p = Patient(
                name=name,
                status="waiting",
                resource_type_needed=rtype,
                urgency_score=urgency,
                severity=severity,
                department=dept,
                waiting_since=now - timedelta(minutes=waited),
            )
            db.add(p)
            db.flush()
            ev("patient_created", patient=p,
               note=f"{name} registered needing a {rtype} (urgency {urgency}, severity {severity}).",
               minutes_ago=waited + 5)
            ev("patient_waiting", patient=p,
               note=f"{name} joined the waiting queue.", minutes_ago=waited)
            patients.append(p)

        # admitted: (name, type, urgency, minutes_waiting, resource, severity, dept)
        admitted_specs = [
            ("Meera Iyer", "bed", 5, 300, beds[0], "Critical", "ICU"),
            ("Liam O'Brien", "bed", 4, 260, beds[1], "High", "Emergency"),
            ("Elena Petrova", "bed", 3, 180, beds[2], "Medium", "Ward"),
            ("Yuki Tanaka", "theatre", 5, 200, theatres[0], "Critical", "Surgical"),
        ]
        for name, rtype, urgency, waited, resource, severity, dept in admitted_specs:
            p = Patient(
                name=name,
                status="admitted",
                resource_type_needed=rtype,
                urgency_score=urgency,
                severity=severity,
                department=dept,
                waiting_since=now - timedelta(minutes=waited),
                current_resource_id=resource.id,
            )
            db.add(p)
            db.flush()
            ev("patient_created", patient=p,
               note=f"{name} registered needing a {rtype} (urgency {urgency}).",
               minutes_ago=waited + 5)
            ev("patient_waiting", patient=p,
               note=f"{name} joined the waiting queue.", minutes_ago=waited)
            ev("resource_committed", patient=p, resource=resource,
               note=f"{resource.name} committed to {name}.", minutes_ago=waited - 20)
            ev("patient_admitted", patient=p, resource=resource,
               note=f"{name} admitted to {resource.name}.", minutes_ago=waited - 15)
            patients.append(p)

        # discharged: (name, type, urgency, minutes_waiting, severity)
        discharged_specs = [
            ("Omar Haddad", "bed", 4, 400, "High"),
            ("Grace Kim", "theatre", 3, 350, "Medium"),
            ("Daniel Costa", "staff", 2, 300, "Low"),
        ]
        for name, rtype, urgency, waited, severity in discharged_specs:
            p = Patient(
                name=name,
                status="discharged",
                resource_type_needed=rtype,
                urgency_score=urgency,
                severity=severity,
                waiting_since=now - timedelta(minutes=waited),
            )
            db.add(p)
            db.flush()
            ev("patient_created", patient=p,
               note=f"{name} registered needing a {rtype} (urgency {urgency}).",
               minutes_ago=waited + 5)
            ev("patient_waiting", patient=p,
               note=f"{name} joined the waiting queue.", minutes_ago=waited)
            ev("patient_discharged", patient=p,
               note=f"{name} discharged.", minutes_ago=max(5, waited - 250))
            patients.append(p)

        # ----------------------------------------------------------------- ambulances
        ambulances_data = [
            ("A102", 8, "Critical", "ICU Bed", "Patient A102"),
            ("A205", 14, "High", "Emergency Bed", "Patient A205"),
            ("A311", 21, "Medium", "Ward Bed", "Patient A311"),
        ]
        for code, eta, severity, req_res, p_name in ambulances_data:
            amb_patient = Patient(
                name=p_name,
                status="en_route",
                resource_type_needed="bed",
                urgency_score=9 if severity == "Critical" else (7 if severity == "High" else 5),
                severity=severity,
                department="ICU" if "ICU" in req_res else "Emergency",
                ambulance_id=code,
                eta_minutes=eta,
                waiting_since=now,
            )
            db.add(amb_patient)
            db.flush()

            amb = Ambulance(
                ambulance_code=code,
                eta_minutes=eta,
                severity=severity,
                required_resource=req_res,
                status="En Route",
                patient_id=amb_patient.id,
            )
            db.add(amb)
            ev("ambulance_en_route", patient=amb_patient,
               note=f"Ambulance {code} en route. ETA: {eta} min. Severity: {severity}. Needed: {req_res}.")

        # ----------------------------------------------------------------- theatre bookings
        booking1 = TheatreBooking(
            theatre_id=theatres[0].id,
            patient_id=patients[3].id,
            surgery_name="Emergency Laparotomy",
            required_specialty="General Surgery",
            required_staff="Dr. Marcus Vance",
            start_time=now + timedelta(minutes=15),
            end_time=now + timedelta(minutes=135),
            duration_minutes=120,
            status="Scheduled",
        )
        booking2 = TheatreBooking(
            theatre_id=theatres[1].id,
            patient_id=None,
            surgery_name="Orthopaedic Trauma Fixation",
            required_specialty="Orthopaedics",
            required_staff="Dr. Thomas Cole",
            start_time=now + timedelta(minutes=45),
            end_time=now + timedelta(minutes=135),
            duration_minutes=90,
            status="Scheduled",
        )
        db.add_all([booking1, booking2])

        # recommendation event
        ev("match_recommended", patient=patients[0], resource=beds[8],
           note=f"Recommended {patients[0].name} for {beds[8].name}: "
                f"Urgency {patients[0].urgency_score}, waiting 95 min.",
           minutes_ago=1)

        _add_events(db, events)
        db.commit()

        return {
            "resources": {"bed": 20, "theatre": 5, "staff": 10},
            "patients": {"waiting": 7, "admitted": 4, "discharged": 3},
            "events": len(events),
        }
    finally:
        db.close()


if __name__ == "__main__":
    summary = seed()
    print("Seed complete.")
    print(f"  resources: {summary['resources']}")
    print(f"  patients:  {summary['patients']}")
    print(f"  events:    {summary['events']}")
