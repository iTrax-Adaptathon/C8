"""Read-only audit trail endpoints. There is deliberately no write path."""
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.repositories import event_repository
from backend.schemas.pydantic_schemas import EventOut

router = APIRouter(prefix="/events", tags=["events"])


@router.get("/recent", response_model=List[EventOut])
def recent_events(limit: int = Query(default=50, ge=1, le=500), db: Session = Depends(get_db)):
    return event_repository.list_recent(db, limit)
