"""Bulk auto-allocation endpoint: drain the waiting queue into free resources."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.schemas.pydantic_schemas import AutoAllocateResult
from backend.services import allocation_service

router = APIRouter(prefix="/allocations", tags=["allocations"])


@router.post("/auto-allocate", response_model=AutoAllocateResult)
def auto_allocate(db: Session = Depends(get_db)):
    result = allocation_service.auto_allocate_waiting(db)
    return AutoAllocateResult(allocated=result["allocated"], message=result["message"])
