"""Router: /theatres endpoints for schedule and booking with conflict prevention."""
from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.db_models import Resource
from backend.schemas.pydantic_schemas import ResourceOut, TheatreBookingCreate, TheatreBookingOut
from backend.services import theatre_service

router = APIRouter(prefix="/theatres", tags=["theatres"])


@router.get("", response_model=List[ResourceOut])
def list_theatres(db: Session = Depends(get_db)):
    return theatre_service.list_theatres(db)


@router.get("/bookings", response_model=List[TheatreBookingOut])
def list_bookings(theatre_id: Optional[int] = None, db: Session = Depends(get_db)):
    bookings = theatre_service.list_bookings(db, theatre_id=theatre_id)
    # Populate theatre_name
    for b in bookings:
        th = db.get(Resource, b.theatre_id)
        if th:
            setattr(b, "theatre_name", th.name)
    return bookings


@router.post("/bookings", response_model=TheatreBookingOut, status_code=201)
def create_booking(payload: TheatreBookingCreate, db: Session = Depends(get_db)):
    booking = theatre_service.create_theatre_booking(db, payload)
    th = db.get(Resource, booking.theatre_id)
    if th:
        setattr(booking, "theatre_name", th.name)
    return booking
