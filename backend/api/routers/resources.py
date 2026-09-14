"""Resource endpoints, including the atomic allocate/release operations."""
from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.schemas.pydantic_schemas import (
    AllocateRequest,
    AllocationResult,
    PatientOut,
    ResourceOut,
    ResourceStatusUpdate,
)
from backend.services import allocation_service, resource_service

router = APIRouter(prefix="/resources", tags=["resources"])


@router.get("", response_model=List[ResourceOut])
def list_resources(db: Session = Depends(get_db)):
    return resource_service.list_resources(db)


@router.get("/{resource_id}", response_model=ResourceOut)
def get_resource(resource_id: int, db: Session = Depends(get_db)):
    return resource_service.get_resource(db, resource_id)


@router.patch("/{resource_id}/status", response_model=ResourceOut)
def update_resource_status(
    resource_id: int, body: ResourceStatusUpdate, db: Session = Depends(get_db)
):
    return resource_service.update_status(db, resource_id, body.status, body.note)


@router.post("/{resource_id}/allocate", response_model=AllocationResult)
def allocate_resource(
    resource_id: int,
    body: Optional[AllocateRequest] = None,
    db: Session = Depends(get_db),
):
    patient_id = body.patient_id if body else None
    result = allocation_service.allocate(db, resource_id, patient_id)
    return AllocationResult(
        success=True,
        message=result["message"],
        resource=ResourceOut.model_validate(result["resource"]),
        patient=PatientOut.model_validate(result["patient"]),
    )


@router.post("/{resource_id}/release", response_model=ResourceOut)
def release_resource(resource_id: int, db: Session = Depends(get_db)):
    return allocation_service.release(db, resource_id)
