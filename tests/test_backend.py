"""Backend tests covering the acceptance-critical behaviours.

Run:  .venv\\Scripts\\python -m pytest tests -v
"""
import threading

import pytest
from fastapi.testclient import TestClient

from backend.database import SessionLocal, drop_db, init_db
from backend.errors import ConflictError, UnprocessableError
from backend.main import app
from backend.models.db_models import Resource
from backend.repositories import resource_repository as resource_repo
from backend.schemas.pydantic_schemas import PatientCreate
from backend.services import allocation_service, matching_service, patient_service


@pytest.fixture(autouse=True)
def fresh_db():
    drop_db()
    init_db()
    yield
    drop_db()


def make_resource(name: str, rtype: str = "bed", status: str = "available") -> int:
    db = SessionLocal()
    try:
        resource = Resource(type=rtype, name=name, status=status)
        db.add(resource)
        db.commit()
        db.refresh(resource)
        return resource.id
    finally:
        db.close()


def make_patient(name: str, rtype: str = "bed", urgency: int = 3):
    db = SessionLocal()
    try:
        patient = patient_service.create_patient(
            db, PatientCreate(name=name, resource_type_needed=rtype, urgency_score=urgency)
        )
        return patient.id
    finally:
        db.close()


# --------------------------------------------------------------- health / seed


def test_health_and_seed_reset():
    from seed import seed

    summary = seed()
    assert summary["resources"] == {"bed": 20, "theatre": 5, "staff": 10}
    assert summary["patients"] == {"waiting": 7, "admitted": 4, "discharged": 3}

    client = TestClient(app)
    assert client.get("/health").json()["status"] == "ok"
    assert len(client.get("/resources").json()) == 35
    assert len(client.get("/patients/waiting").json()) == 7


def test_patient_extended_fields_and_transition_audit():
    db = SessionLocal()
    try:
        patient = patient_service.create_patient(
            db,
            PatientCreate(
                name="Extended Patient",
                age=42,
                resource_type_needed="bed",
                urgency_score=8,
                estimated_treatment_minutes=90,
            ),
        )
        patient_service.update_status(
            db, patient.id, "discharged", staff_name="Discharge Desk", reason="Transferred home"
        )
        refreshed = patient_service.get_patient(db, patient.id)
        history = patient_service.get_history(db, patient.id)
    finally:
        db.close()

    assert refreshed.age == 42
    assert refreshed.estimated_treatment_minutes == 90
    discharge_event = next(event for event in history if event.event_type == "patient_discharged")
    assert discharge_event.previous_state == "waiting"
    assert discharge_event.new_state == "discharged"
    assert discharge_event.actor == "Discharge Desk"


def test_ambulance_keeps_patient_name_and_arrival_transition():
    client = TestClient(app)
    response = client.post(
        "/ambulances",
        json={
            "ambulance_code": "A901",
            "patient_name": "Incoming Patient",
            "eta_minutes": 8,
            "severity": "Critical",
            "required_resource": "ICU Bed",
        },
    )
    assert response.status_code == 201
    ambulance = response.json()
    assert ambulance["patient_name"] == "Incoming Patient"

    arrived = client.post(f"/ambulances/{ambulance['id']}/arrive")
    assert arrived.status_code == 200

    db = SessionLocal()
    try:
        patient = patient_service.get_patient(db, ambulance["patient_id"])
        history = patient_service.get_history(db, patient.id)
    finally:
        db.close()

    assert patient.status == "waiting"
    arrived_event = next(event for event in history if event.event_type == "patient_arrived")
    waiting_event = next(event for event in history if event.event_type == "patient_waiting")
    assert arrived_event.previous_state == "en_route"
    assert arrived_event.new_state == "arrived"
    assert waiting_event.previous_state == "arrived"
    assert waiting_event.new_state == "waiting"


def test_capacity_can_add_and_remove_available_units():
    client = TestClient(app)
    response = client.post(
        "/resources",
        json={
            "type": "staff",
            "name": "ICU Nurse",
            "quantity": 2,
            "department": "Critical Care",
            "role": "Nurse",
        },
    )
    assert response.status_code == 201
    created = response.json()
    assert len(created) == 2
    assert all(resource["status"] == "available" for resource in created)

    removed = client.delete(f"/resources/{created[0]['id']}")
    assert removed.status_code == 204
    assert client.get(f"/resources/{created[0]['id']}").status_code == 404


def test_capacity_cannot_remove_committed_unit():
    resource_id = make_resource("Protected ICU Bed")
    patient_id = make_patient("Protected Patient", "bed", urgency=8)
    db = SessionLocal()
    try:
        allocation_service.allocate(db, resource_id, patient_id)
    finally:
        db.close()

    response = TestClient(app).delete(f"/resources/{resource_id}")
    assert response.status_code == 409


# --------------------------------------------------------------- matching order


def test_matching_prefers_urgency_then_wait_time():
    make_resource("Theatre T1", "theatre")
    # lower urgency but longer wait
    make_patient("Low Urgency Long Wait", "theatre", urgency=2)
    # highest urgency, shorter wait -> must win
    make_patient("High Urgency", "theatre", urgency=9)

    db = SessionLocal()
    try:
        recs = matching_service.get_recommendations(db)
    finally:
        db.close()

    assert len(recs) == 1
    assert recs[0]["patient_name"] == "High Urgency"
    labels = [r["label"] for r in recs[0]["reasons"]]
    assert "Theatre compatible" in labels
    assert "Highest urgency" in labels
    assert "Resource available" in labels


def test_matching_tie_break_is_waiting_time():
    make_resource("Ward B1", "bed")
    db = SessionLocal()
    try:
        from datetime import timedelta

        from backend.models.db_models import Patient, utcnow

        older = Patient(
            name="Older",
            status="waiting",
            resource_type_needed="bed",
            urgency_score=4,
            waiting_since=utcnow() - timedelta(minutes=60),
        )
        newer = Patient(
            name="Newer",
            status="waiting",
            resource_type_needed="bed",
            urgency_score=4,
            waiting_since=utcnow() - timedelta(minutes=5),
        )
        db.add_all([older, newer])
        db.commit()
        recs = matching_service.get_recommendations(db)
    finally:
        db.close()
    assert recs[0]["patient_name"] == "Older"


# --------------------------------------------------------------- safe allocation


def test_concurrent_allocation_only_one_succeeds():
    """AC-5: two simultaneous attempts, at most one wins."""
    resource_id = make_resource("ICU B999")
    patient_id = make_patient("Race Patient", "bed", urgency=5)

    results = {}
    barrier = threading.Barrier(2)

    def worker(idx):
        db = SessionLocal()
        try:
            barrier.wait()  # maximise overlap
            allocation_service.allocate(db, resource_id, patient_id)
            results[idx] = "success"
        except ConflictError:
            results[idx] = "conflict"
        finally:
            db.close()

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert sorted(results.values()) == ["conflict", "success"]


def test_allocate_without_eligible_patient_returns_422():
    resource_id = make_resource("Ward B7", "bed")
    db = SessionLocal()
    try:
        with pytest.raises(UnprocessableError):
            allocation_service.allocate(db, resource_id)
    finally:
        db.close()


def test_allocate_then_double_allocate_is_rejected():
    resource_id = make_resource("ICU B1")
    make_patient("First", "bed", urgency=5)
    db = SessionLocal()
    try:
        allocation_service.allocate(db, resource_id)
    finally:
        db.close()
    make_patient("Second", "bed", urgency=9)
    db = SessionLocal()
    try:
        with pytest.raises(ConflictError):
            allocation_service.allocate(db, resource_id)
    finally:
        db.close()


# --------------------------------------------------------------- release / discharge


def test_release_returns_resource_and_logs_event():
    resource_id = make_resource("Theatre T7", "theatre")
    patient_id = make_patient("Theatre Patient", "theatre", urgency=5)
    db = SessionLocal()
    try:
        allocation_service.allocate(db, resource_id)
        resource = allocation_service.release(db, resource_id)
        assert resource.status == "available"
        history = patient_service.get_history(db, patient_id)
        types = [e.event_type for e in history]
        assert "resource_released" in types
        assert "patient_waiting" in types  # returned to queue
    finally:
        db.close()


def test_discharge_releases_resource_and_logs_event():
    resource_id = make_resource("Ward B2", "bed")
    patient_id = make_patient("Discharge Me", "bed", urgency=5)
    db = SessionLocal()
    try:
        allocation_service.allocate(db, resource_id)
        patient = patient_service.discharge(db, patient_id)
        assert patient.status == "discharged"
        resource = allocation_service.resource_repo.get_resource(db, resource_id)
        assert resource.status == "available"
        types = [e.event_type for e in patient_service.get_history(db, patient_id)]
        assert "patient_admitted" in types
        assert "patient_discharged" in types
        assert "resource_released" in types
    finally:
        db.close()


# --------------------------------------------------------------- transfer / care path


def test_icu_patient_transfers_to_ward_bed():
    icu_id = make_resource("ICU B10")
    ward_id = make_resource("Ward B10")
    patient_id = make_patient("ICU Patient", "bed", urgency=5)
    db = SessionLocal()
    try:
        allocation_service.allocate(db, icu_id, patient_id)
        patient = patient_service.transfer(db, patient_id, ward_id)
        assert patient.status == "admitted"
        assert patient.current_resource_id == ward_id
        assert resource_repo.get_resource(db, icu_id).status == "available"
        assert resource_repo.get_resource(db, ward_id).status == "committed"
        types = [e.event_type for e in patient_service.get_history(db, patient_id)]
        assert "patient_transferred" in types
    finally:
        db.close()


def test_theatre_patient_transfers_to_icu_bed():
    theatre_id = make_resource("Theatre T9", "theatre")
    icu_id = make_resource("ICU B11")
    patient_id = make_patient("Theatre Patient", "theatre", urgency=5)
    db = SessionLocal()
    try:
        allocation_service.allocate(db, theatre_id, patient_id)
        patient = patient_service.transfer(db, patient_id, icu_id)
        assert patient.status == "admitted"
        assert patient.current_resource_id == icu_id
        assert resource_repo.get_resource(db, theatre_id).status == "available"
        assert resource_repo.get_resource(db, icu_id).status == "committed"
    finally:
        db.close()


def test_ward_patient_cannot_transfer():
    ward_id = make_resource("Ward B11")
    another_ward_id = make_resource("Ward B12")
    patient_id = make_patient("Ward Patient", "bed", urgency=3)
    db = SessionLocal()
    try:
        allocation_service.allocate(db, ward_id, patient_id)
        with pytest.raises(UnprocessableError):
            patient_service.transfer(db, patient_id, another_ward_id)
    finally:
        db.close()


def test_transfer_rejects_wrong_target_kind():
    icu_id = make_resource("ICU B12")
    another_icu_id = make_resource("ICU B13")
    patient_id = make_patient("ICU Patient 2", "bed", urgency=4)
    db = SessionLocal()
    try:
        allocation_service.allocate(db, icu_id, patient_id)
        with pytest.raises(UnprocessableError):
            patient_service.transfer(db, patient_id, another_icu_id)
    finally:
        db.close()


# --------------------------------------------------------------- auto allocation


def test_auto_allocate_drains_waiting_queue():
    make_resource("Ward B20", "bed")
    make_resource("Ward B21", "bed")
    make_patient("Auto A", "bed", urgency=5)
    make_patient("Auto B", "bed", urgency=4)
    db = SessionLocal()
    try:
        result = allocation_service.auto_allocate_waiting(db)
        assert result["allocated"] == 2
        assert patient_service.list_waiting(db) == []
    finally:
        db.close()


def test_auto_allocate_respects_resource_type():
    make_resource("Ward B22", "bed")
    make_patient("Needs Theatre", "theatre", urgency=9)
    db = SessionLocal()
    try:
        result = allocation_service.auto_allocate_waiting(db)
        assert result["allocated"] == 0
        assert len(patient_service.list_waiting(db)) == 1
    finally:
        db.close()


def test_auto_allocate_endpoint():
    client = TestClient(app)
    make_resource("Ward B23", "bed")
    make_resource("Ward B24", "bed")
    make_patient("Endpoint A", "bed", urgency=3)
    make_patient("Endpoint B", "bed", urgency=2)
    response = client.post("/allocations/auto-allocate")
    assert response.status_code == 200, response.text
    assert response.json()["allocated"] == 2


# --------------------------------------------------------------- API surface


def test_events_are_read_only():
    client = TestClient(app)
    methods = {
        (route.path, method)
        for route in app.routes
        if hasattr(route, "methods")
        for method in route.methods
    }
    # no mutation verbs exist for the audit trail
    assert ("/events/recent", "POST") not in methods
    assert all(not (path.startswith("/events") and m in {"PUT", "DELETE", "PATCH"}) for path, m in methods)
    assert client.get("/events/recent").status_code == 200


def test_allocate_endpoint_returns_409_for_second_caller():
    client = TestClient(app)
    resource_id = make_resource("ICU B42")
    make_patient("A", "bed", urgency=5)
    make_patient("B", "bed", urgency=4)
    db = SessionLocal()
    try:
        patient_b = patient_service.list_waiting(db)[-1]
        b_id = patient_b.id
    finally:
        db.close()

    first = client.post(f"/resources/{resource_id}/allocate", json={})
    assert first.status_code == 200, first.text
    second = client.post(
        f"/resources/{resource_id}/allocate", json={"patient_id": b_id}
    )
    assert second.status_code == 409
    assert "committed" in second.json()["detail"].lower()


# --------------------------------------------------------------- Ambulances & Reservations


def test_ambulance_creation_and_capacity_check():
    client = TestClient(app)
    icu_id = make_resource("ICU B50", "bed")

    # Create ambulance
    payload = {
        "ambulance_code": "A999",
        "eta_minutes": 10,
        "severity": "Critical",
        "required_resource": "ICU Bed",
        "patient_name": "Critical Cardiac Arrival",
    }
    resp = client.post("/ambulances", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["ambulance_code"] == "A999"
    assert data["status"] == "En Route"
    amb_id = data["id"]

    # Capacity check
    check_resp = client.get(f"/ambulances/{amb_id}/capacity-check")
    assert check_resp.status_code == 200
    assert check_resp.json()["available"] is True

    # Reserve bed for ambulance
    reserve_resp = client.post(f"/ambulances/{amb_id}/reserve", json={"resource_id": icu_id})
    assert reserve_resp.status_code == 200
    assert reserve_resp.json()["reserved_resource_id"] == icu_id

    # Check resource is now 'reserved'
    res_resp = client.get(f"/resources/{icu_id}")
    assert res_resp.json()["status"] == "reserved"

    # Concurrent or second reservation should be rejected
    db = SessionLocal()
    try:
        from backend.errors import ConflictError
        p2_id = make_patient("Other Waiting", "bed")
        with pytest.raises(ConflictError):
            allocation_service.reserve(db, icu_id, p2_id)
    finally:
        db.close()

    # Mark arrived
    arrived_resp = client.post(f"/ambulances/{amb_id}/arrive")
    assert arrived_resp.status_code == 200
    assert arrived_resp.json()["status"] == "Arrived"


def test_ambulance_cancel_releases_reservation():
    client = TestClient(app)
    ward_id = make_resource("Ward B99", "bed")

    resp = client.post(
        "/ambulances",
        json={
            "ambulance_code": "A888",
            "eta_minutes": 15,
            "severity": "Medium",
            "required_resource": "Ward Bed",
        },
    )
    amb_id = resp.json()["id"]

    client.post(f"/ambulances/{amb_id}/reserve", json={"resource_id": ward_id})
    assert client.get(f"/resources/{ward_id}").json()["status"] == "reserved"

    # Cancel ambulance
    cancel_resp = client.post(f"/ambulances/{amb_id}/cancel")
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] == "Cancelled"

    # Bed should now be released back to available
    assert client.get(f"/resources/{ward_id}").json()["status"] == "available"


def test_theatre_booking_conflict_prevention():
    client = TestClient(app)
    th_id = make_resource("Theatre T42", "theatre")
    from datetime import datetime, timezone, timedelta

    start = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=1)
    booking1 = {
        "theatre_id": th_id,
        "surgery_name": "Appendectomy",
        "required_specialty": "General Surgery",
        "start_time": start.isoformat(),
        "duration_minutes": 60,
    }
    b1_resp = client.post("/theatres/bookings", json=booking1)
    assert b1_resp.status_code == 201

    # Attempt overlapping booking
    overlapping = {
        "theatre_id": th_id,
        "surgery_name": "Emergency Hernia",
        "required_specialty": "General Surgery",
        "start_time": (start + timedelta(minutes=30)).isoformat(),
        "duration_minutes": 60,
    }
    b2_resp = client.post("/theatres/bookings", json=overlapping)
    assert b2_resp.status_code == 409
    assert "conflict" in b2_resp.json()["detail"].lower()


def test_discharge_pending_and_release():
    client = TestClient(app)
    bed_id = make_resource("Ward B88", "bed")
    pat_id = make_patient("Patient Discharge Flow", "bed")

    # Allocate
    client.post(f"/resources/{bed_id}/allocate", json={"patient_id": pat_id})
    assert client.get(f"/resources/{bed_id}").json()["status"] == "committed"

    # Mark discharge pending
    dp_resp = client.post(f"/patients/{pat_id}/discharge-pending")
    assert dp_resp.status_code == 200
    assert dp_resp.json()["status"] == "discharge_pending"
    # Bed stays committed until actual discharge
    assert client.get(f"/resources/{bed_id}").json()["status"] == "committed"

    # Final discharge
    dc_resp = client.post(f"/patients/{pat_id}/discharge")
    assert dc_resp.status_code == 200
    assert dc_resp.json()["status"] == "discharged"
    # Bed is now released back to available
    assert client.get(f"/resources/{bed_id}").json()["status"] == "available"


def test_dashboard_summary_endpoint():
    client = TestClient(app)
    from seed import seed
    seed()

    resp = client.get("/dashboard/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert "beds_available" in data
    assert "staff_available" in data
    assert "ambulances_en_route" in data
    assert "critical_bottlenecks" in data
    assert "patient_flow" in data
    assert len(data["incoming_ambulances"]) >= 1

