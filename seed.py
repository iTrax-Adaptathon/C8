"""Reproducible demo seed for the Hospital Capacity platform.

Usage:
    python seed.py

Wipes all three tables and recreates a known, usable demo state:
  - 20 beds           (12 available / 8 committed)
  - 5 theatre slots   ( 3 available / 2 committed)
  - 10 staff units    ( 8 available / 2 committed)
  - 14 patients       ( 7 waiting / 4 admitted / 3 discharged)
  - a matching audit trail in `events`

Idempotent: run it as often as you like to reset after a demo/bug.
"""
from datetime import timedelta

from backend.database import SessionLocal, drop_db, init_db
from backend.models.db_models import Event, Patient, Resource, utcnow


def _add_events(db, rows):
    db.add_all(rows)


def seed() -> dict:
    drop_db()
    init_db()

    db = SessionLocal()
    now = utcnow()
    try:
        # ---------------------------------------------------------------- resources
        beds = [
            Resource(
                type="bed",
                name=f"{'ICU' if i <= 6 else 'Ward'} B{100 + i}",
                status="available",
                version=0,
                updated_at=now,
            )
            for i in range(1, 21)
        ]
        theatres = [
            Resource(type="theatre", name=f"Theatre T{i}", status="available", version=0, updated_at=now)
            for i in range(1, 6)
        ]
        staff = [
            Resource(type="staff", name=f"Staff Unit S{i}", status="available", version=0, updated_at=now)
            for i in range(1, 11)
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

        def ev(event_type, patient=None, resource=None, note=None, minutes_ago=0):
            events.append(
                Event(
                    patient_id=patient.id if patient else None,
                    resource_id=resource.id if resource else None,
                    event_type=event_type,
                    note=note,
                    created_at=now - timedelta(minutes=minutes_ago),
                )
            )

        # events for committed resources with no patient (occupied / blocked)
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
        # waiting: (name, type, urgency, minutes_waiting)
        waiting_specs = [
            ("Aarav Sharma", "bed", 5, 95),
            ("Priya Nair", "bed", 4, 70),
            ("Rohan Mehta", "bed", 4, 45),
            ("Isla Fernandes", "bed", 3, 30),
            ("Wei Chen", "theatre", 5, 120),
            ("Sofia Rossi", "theatre", 3, 60),
            ("Noah Williams", "staff", 4, 40),
        ]
        patients = []
        for name, rtype, urgency, waited in waiting_specs:
            p = Patient(
                name=name,
                status="waiting",
                resource_type_needed=rtype,
                urgency_score=urgency,
                waiting_since=now - timedelta(minutes=waited),
            )
            db.add(p)
            db.flush()
            ev("patient_created", patient=p,
               note=f"{name} registered needing a {rtype} (urgency {urgency}).",
               minutes_ago=waited + 5)
            ev("patient_waiting", patient=p,
               note=f"{name} joined the waiting queue.", minutes_ago=waited)
            patients.append(p)

        # admitted: (name, type, urgency, minutes_waiting, resource)
        admitted_specs = [
            ("Meera Iyer", "bed", 5, 300, beds[0]),
            ("Liam O'Brien", "bed", 4, 260, beds[1]),
            ("Elena Petrova", "bed", 3, 180, beds[2]),
            ("Yuki Tanaka", "theatre", 5, 200, theatres[0]),
        ]
        for name, rtype, urgency, waited, resource in admitted_specs:
            p = Patient(
                name=name,
                status="admitted",
                resource_type_needed=rtype,
                urgency_score=urgency,
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

        # discharged: (name, type, urgency, minutes_waiting)
        discharged_specs = [
            ("Omar Haddad", "bed", 4, 400),
            ("Grace Kim", "theatre", 3, 350),
            ("Daniel Costa", "staff", 2, 300),
        ]
        for name, rtype, urgency, waited in discharged_specs:
            p = Patient(
                name=name,
                status="discharged",
                resource_type_needed=rtype,
                urgency_score=urgency,
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

        # a live recommendation event so the audit trail shows matching
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
