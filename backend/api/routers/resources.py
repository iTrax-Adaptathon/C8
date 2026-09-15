"""Resource endpoints, including atomic reserve/allocate/release operations and staff management."""
from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.db_models import Resource
from backend.schemas.pydantic_schemas import (
    AllocateRequest,
    AllocationResult,
    PatientOut,
    ReserveRequest,
    ResourceOut,
    ResourceCreate,
    ResourceStatusUpdate,
    StaffMemberOut,
    StaffUpdate,
)
from backend.services import allocation_service, resource_service

router = APIRouter(prefix="/resources", tags=["resources"])


@router.get("", response_model=List[ResourceOut])
def list_resources(type: Optional[str] = None, db: Session = Depends(get_db)):
    if type:
        from backend.repositories import resource_repository as rr
        return rr.list_resources(db, resource_type=type)
    return resource_service.list_resources(db)


@router.post("", response_model=List[ResourceOut], status_code=201)
def create_resources(body: ResourceCreate, db: Session = Depends(get_db)):
    return resource_service.create_resources(db, body)


@router.get("/staff", response_model=List[StaffMemberOut])
def list_staff(db: Session = Depends(get_db)):
    from backend.repositories import patient_repository as pr
    from backend.repositories import resource_repository as rr
    staff_units = rr.list_resources(db, resource_type="staff")
    result = []
    for s in staff_units:
        # count patients currently assigned
        assigned_count = 1 if s.status == "committed" else 0
        result.append(
            StaffMemberOut(
                id=s.id,
                name=s.name,
                role=getattr(s, "role", "Clinician") or "Clinician",
                specialty=getattr(s, "specialty", "General") or "General",
                department=getattr(s, "department", "General") or "General",
                shift=getattr(s, "shift", "Day Shift") or "Day Shift",
                availability=getattr(s, "availability", "available") or "available",
                workload=getattr(s, "workload", 0) or 0,
                assigned_patients_count=assigned_count,
            )
        )
    return result


@router.patch("/staff/{staff_id}", response_model=ResourceOut)
def update_staff(staff_id: int, body: StaffUpdate, db: Session = Depends(get_db)):
    staff = resource_service.get_resource(db, staff_id)
    if body.availability is not None:
        staff.availability = body.availability
        if body.availability in ["busy", "off_shift"]:
            staff.status = "committed"
        elif body.availability == "available":
            staff.status = "available"
    if body.shift is not None:
        staff.shift = body.shift
    if body.workload is not None:
        staff.workload = body.workload
    db.commit()
    db.refresh(staff)
    return staff


@router.get("/{resource_id}", response_model=ResourceOut)
def get_resource(resource_id: int, db: Session = Depends(get_db)):
    return resource_service.get_resource(db, resource_id)


@router.delete("/{resource_id}", status_code=204)
def remove_resource(resource_id: int, db: Session = Depends(get_db)):
    resource_service.remove_resource(db, resource_id)


@router.patch("/{resource_id}/status", response_model=ResourceOut)
def update_resource_status(
    resource_id: int, body: ResourceStatusUpdate, db: Session = Depends(get_db)
):
    return resource_service.update_status(db, resource_id, body.status, body.note)


@router.post("/{resource_id}/reserve", response_model=AllocationResult)
def reserve_resource(
    resource_id: int,
    body: ReserveRequest,
    db: Session = Depends(get_db),
):
    result = allocation_service.reserve(
        db,
        resource_id=resource_id,
        patient_id=body.patient_id,
        staff_name=body.staff_name,
        reason=body.reason,
    )
    return AllocationResult(
        success=True,
        message=result["message"],
        resource=ResourceOut.model_validate(result["resource"]),
        patient=PatientOut.model_validate(result["patient"]),
    )


@router.post("/{resource_id}/cancel-reservation", response_model=AllocationResult)
def cancel_reservation(
    resource_id: int,
    db: Session = Depends(get_db),
):
    result = allocation_service.cancel_reservation(db, resource_id=resource_id)
    return AllocationResult(
        success=True,
        message=result["message"],
        resource=ResourceOut.model_validate(result["resource"]),
        patient=PatientOut.model_validate(result["patient"]) if result["patient"] else None,
    )


@router.post("/{resource_id}/allocate", response_model=AllocationResult)
def allocate_resource(
    resource_id: int,
    body: Optional[AllocateRequest] = None,
    db: Session = Depends(get_db),
):
    patient_id = body.patient_id if body else None
    staff_name = body.staff_name if body else None
    reason = body.reason if body else None
    result = allocation_service.allocate(
        db, resource_id, patient_id=patient_id, staff_name=staff_name, reason=reason
    )
    return AllocationResult(
        success=True,
        message=result["message"],
        resource=ResourceOut.model_validate(result["resource"]),
        patient=PatientOut.model_validate(result["patient"]),
    )


@router.post("/{resource_id}/release", response_model=ResourceOut)
def release_resource(resource_id: int, db: Session = Depends(get_db)):
    return allocation_service.release(db, resource_id)
