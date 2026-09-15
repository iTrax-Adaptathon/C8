"""SQLAlchemy ORM mappings for the MedFlow data model.

resources        -> current commitment state (available | reserved | committed)
patients         -> en_route | arrived | waiting | reserved | admitted | discharge_pending | discharged
ambulances       -> En Route | Arrived | Cancelled
theatre_bookings -> Scheduled | In Progress | Completed | Cancelled
events           -> insert-only audit trail (never updated or deleted)
"""
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String

from backend.database import Base


def utcnow() -> datetime:
    """Naive UTC timestamp.

    SQLite stores datetimes without timezone info, so we keep everything in
    naive UTC for a consistent, comparable value in the database.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, autoincrement=True)
    type = Column(String, nullable=False, index=True)  # bed | theatre | staff
    name = Column(String, nullable=False)
    status = Column(String, nullable=False, default="available", index=True)  # available | reserved | committed
    version = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    # Enhanced fields for clinical patient-flow & reservations
    reserved_for_patient_id = Column(Integer, nullable=True)
    department = Column(String, nullable=True)  # ICU | Emergency | Ward | Surgical
    specialty = Column(String, nullable=True)  # Critical Care | General Surgery | Emergency | Internal Medicine

    # Staff-specific fields
    role = Column(String, nullable=True)  # Physician | ICU Nurse | Surgeon | Anaesthetist | Ward Nurse
    shift = Column(String, nullable=True)  # Day Shift | Night Shift | On Call
    availability = Column(String, nullable=True, default="available")  # available | busy | on_break | off_shift
    workload = Column(Integer, nullable=False, default=0)


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    age = Column(Integer, nullable=True)
    # en_route | arrived | waiting | reserved | admitted | discharge_pending | discharged
    status = Column(String, nullable=False, default="waiting", index=True)
    resource_type_needed = Column(String, nullable=False)  # bed | theatre | staff
    urgency_score = Column(Integer, nullable=False, default=3)
    waiting_since = Column(DateTime, nullable=False, default=utcnow)

    # Current resource pointer (nullable)
    current_resource_id = Column(Integer, ForeignKey("resources.id"), nullable=True)

    # Enhanced patient information
    severity = Column(String, nullable=False, default="Medium")  # Critical | High | Medium | Low
    department = Column(String, nullable=True)  # ICU | Emergency | Ward | Surgical
    specialty_needed = Column(String, nullable=True)
    assigned_staff_id = Column(Integer, ForeignKey("resources.id"), nullable=True)
    ambulance_id = Column(String, nullable=True)
    eta_minutes = Column(Integer, nullable=True)
    estimated_treatment_minutes = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utcnow)
    updated_at = Column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)


class Ambulance(Base):
    __tablename__ = "ambulances"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ambulance_code = Column(String, nullable=False, unique=True, index=True)  # e.g. A102
    patient_name = Column(String, nullable=True)
    eta_minutes = Column(Integer, nullable=False)
    severity = Column(String, nullable=False)  # Critical | High | Medium | Low
    required_resource = Column(String, nullable=False)  # ICU Bed | Emergency Bed | Ward Bed | Theatre
    status = Column(String, nullable=False, default="En Route", index=True)  # En Route | Arrived | Cancelled

    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=True)
    reserved_resource_id = Column(Integer, ForeignKey("resources.id"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=utcnow)
    updated_at = Column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)


class TheatreBooking(Base):
    __tablename__ = "theatre_bookings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    theatre_id = Column(Integer, ForeignKey("resources.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=True)
    surgery_name = Column(String, nullable=False)
    required_specialty = Column(String, nullable=False)
    required_staff = Column(String, nullable=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    status = Column(String, nullable=False, default="Scheduled")  # Scheduled | In Progress | Completed | Cancelled


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=True)
    resource_id = Column(Integer, ForeignKey("resources.id"), nullable=True)
    event_type = Column(String, nullable=False, index=True)
    staff_name = Column(String, nullable=True)
    reason = Column(String, nullable=True)
    note = Column(String, nullable=True)
    previous_state = Column(String, nullable=True)
    new_state = Column(String, nullable=True)
    actor = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utcnow, index=True)
