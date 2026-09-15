"""Patient endpoints: queue, intake, history, status transitions, discharge."""
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.schemas.pydantic_schemas import (
    DischargeRequest,
    EventOut,
    PatientCreate,
    PatientOut,
    TransferRequest,
)
from backend.services import allocation_service, patient_service

router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("/waiting", response_model=List[PatientOut])
def waiting_queue(db: Session = Depends(get_db)):
    return patient_service.list_waiting(db)


@router.get("", response_model=List[PatientOut])
def list_patients(
    status: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    return patient_service.list_patients(db, status)


@router.post("", response_model=PatientOut, status_code=201)
def create_patient(body: PatientCreate, db: Session = Depends(get_db)):
    return patient_service.create_patient(db, body)


@router.get("/{patient_id}", response_model=PatientOut)
def get_patient(patient_id: int, db: Session = Depends(get_db)):
    return patient_service.get_patient(db, patient_id)


@router.get("/{patient_id}/history", response_model=List[EventOut])
def patient_history(patient_id: int, db: Session = Depends(get_db)):
    return patient_service.get_history(db, patient_id)


@router.post("/{patient_id}/discharge-pending", response_model=PatientOut)
def mark_discharge_pending(
    patient_id: int,
    body: Optional[DischargeRequest] = None,
    db: Session = Depends(get_db),
):
    staff_name = body.staff_name if body else None
    reason = body.reason if body else None
    return allocation_service.mark_discharge_pending(
        db, patient_id, staff_name=staff_name, reason=reason
    )


@router.post("/{patient_id}/discharge", response_model=PatientOut)
def discharge_patient(
    patient_id: int,
    body: Optional[DischargeRequest] = None,
    db: Session = Depends(get_db),
):
    staff_name = body.staff_name if body else None
    reason = body.reason if body else None
    return patient_service.discharge(db, patient_id, staff_name=staff_name, reason=reason)


@router.post("/{patient_id}/transfer", response_model=PatientOut)
def transfer_patient(patient_id: int, body: TransferRequest, db: Session = Depends(get_db)):
    return patient_service.transfer(db, patient_id, body.target_resource_id)
