"""Explainable matching recommendation endpoint (side-effect free)."""
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.schemas.pydantic_schemas import MatchRecommendation
from backend.services import matching_service

router = APIRouter(tags=["matching"])


@router.get("/matches", response_model=List[MatchRecommendation])
def get_matches(db: Session = Depends(get_db)):
    """Live recommendations: best waiting patient per available resource."""
    return matching_service.get_recommendations(db)
