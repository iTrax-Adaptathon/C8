"""Service layer: Theatre schedule management and conflict prevention."""
from datetime import timedelta
from typing import List, Optional

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from backend.errors import ConflictError, NotFoundError
from backend.models.db_models import Patient, Resource, TheatreBooking, utcnow
from backend.repositories import event_repository as event_repo
from backend.schemas.pydantic_schemas import TheatreBookingCreate


def list_theatres(db: Session) -> List[Resource]:
    stmt = select(Resource).where(Resource.type == "theatre").order_by(Resource.name)
    return list(db.scalars(stmt))


def list_bookings(db: Session, theatre_id: Optional[int] = None) -> List[TheatreBooking]:
    stmt = select(TheatreBooking)
    if theatre_id:
        stmt = stmt.where(TheatreBooking.theatre_id == theatre_id)
    return list(db.scalars(stmt.order_by(TheatreBooking.start_time.asc())))


def check_theatre_conflict(
    db: Session, theatre_id: int, start_time, end_time, exclude_booking_id: Optional[int] = None
) -> Optional[TheatreBooking]:
    """Check if any active booking overlaps with the requested [start_time, end_time]."""
    stmt = select(TheatreBooking).where(
        TheatreBooking.theatre_id == theatre_id,
        TheatreBooking.status.in_(["Scheduled", "In Progress"]),
        TheatreBooking.start_time < end_time,
        TheatreBooking.end_time > start_time,
    )
    if exclude_booking_id:
        stmt = stmt.where(TheatreBooking.id != exclude_booking_id)

    return db.scalars(stmt).first()


def create_theatre_booking(db: Session, data: TheatreBookingCreate) -> TheatreBooking:
    theatre = db.get(Resource, data.theatre_id)
    if theatre is None or theatre.type != "theatre":
        raise NotFoundError(f"Theatre resource {data.theatre_id} was not found.")

    end_time = data.start_time + timedelta(minutes=data.duration_minutes)

    # Overlap validation
    conflict = check_theatre_conflict(db, data.theatre_id, data.start_time, end_time)
    if conflict:
        raise ConflictError(
            f"Theatre conflict: {theatre.name} already booked for '{conflict.surgery_name}' "
            f"from {conflict.start_time.strftime('%H:%M')} to {conflict.end_time.strftime('%H:%M')}."
        )

    booking = TheatreBooking(
        theatre_id=data.theatre_id,
        patient_id=data.patient_id,
        surgery_name=data.surgery_name,
        required_specialty=data.required_specialty,
        required_staff=data.required_staff,
        start_time=data.start_time,
        end_time=end_time,
        duration_minutes=data.duration_minutes,
        status="Scheduled",
    )
    db.add(booking)

    patient_name = ""
    if data.patient_id:
        p = db.get(Patient, data.patient_id)
        if p:
            patient_name = f" for patient {p.name}"

    event_repo.add_event(
        db,
        "theatre_scheduled",
        patient_id=data.patient_id,
        resource_id=theatre.id,
        note=f"{theatre.name} booked for '{booking.surgery_name}'{patient_name} "
        f"({booking.duration_minutes} min, requires {booking.required_specialty}).",
    )

    db.commit()
    db.refresh(booking)
    return booking
