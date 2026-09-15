"""Router: /ambulances endpoints for incoming ambulance tracking and bed pre-reservation."""
from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.schemas.pydantic_schemas import AmbulanceCreate, AmbulanceOut, AmbulanceReserveRequest
from backend.services import ambulance_service

router = APIRouter(prefix="/ambulances", tags=["ambulances"])


@router.get("", response_model=List[AmbulanceOut])
def list_ambulances(status: Optional[str] = None, db: Session = Depends(get_db)):
    return ambulance_service.list_ambulances(db, status=status)


@router.post("", response_model=AmbulanceOut, status_code=201)
def create_ambulance(payload: AmbulanceCreate, db: Session = Depends(get_db)):
    return ambulance_service.create_ambulance(db, payload)


@router.get("/{ambulance_id}", response_model=AmbulanceOut)
def get_ambulance(ambulance_id: int, db: Session = Depends(get_db)):
    return ambulance_service.get_ambulance(db, ambulance_id)


@router.get("/{ambulance_id}/capacity-check")
def check_capacity(ambulance_id: int, db: Session = Depends(get_db)):
    amb = ambulance_service.get_ambulance(db, ambulance_id)
    return ambulance_service.check_resource_availability_for_eta(
        db, required_resource=amb.required_resource, eta_minutes=amb.eta_minutes
    )


@router.post("/{ambulance_id}/reserve", response_model=AmbulanceOut)
def reserve_bed_for_ambulance(
    ambulance_id: int, payload: AmbulanceReserveRequest, db: Session = Depends(get_db)
):
    return ambulance_service.reserve_for_ambulance(
        db, ambulance_id=ambulance_id, resource_id=payload.resource_id, staff_name=payload.staff_name
    )


@router.post("/{ambulance_id}/arrive", response_model=AmbulanceOut)
def mark_arrived(ambulance_id: int, db: Session = Depends(get_db)):
    return ambulance_service.mark_arrived(db, ambulance_id)


@router.post("/{ambulance_id}/cancel", response_model=AmbulanceOut)
def cancel_ambulance(ambulance_id: int, db: Session = Depends(get_db)):
    return ambulance_service.cancel_ambulance(db, ambulance_id)
