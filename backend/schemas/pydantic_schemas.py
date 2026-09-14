"""Pydantic request/response models for the REST API."""
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

ResourceType = Literal["bed", "theatre", "staff"]
ResourceStatus = Literal["available", "committed"]
PatientStatus = Literal["waiting", "admitted", "discharged"]


class ResourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str
    name: str
    status: str
    version: int
    updated_at: datetime


class PatientCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    resource_type_needed: ResourceType
    urgency_score: int = Field(default=3, ge=1, le=10)


class PatientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    status: str
    resource_type_needed: str
    urgency_score: int
    waiting_since: datetime
    current_resource_id: Optional[int] = None


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: Optional[int] = None
    resource_id: Optional[int] = None
    event_type: str
    note: Optional[str] = None
    created_at: datetime


class ResourceStatusUpdate(BaseModel):
    status: ResourceStatus
    note: Optional[str] = None


class AllocateRequest(BaseModel):
    patient_id: Optional[int] = None


class TransferRequest(BaseModel):
    target_resource_id: int


class MatchReason(BaseModel):
    label: str
    detail: str


class MatchRecommendation(BaseModel):
    resource_id: int
    resource_name: str
    resource_type: str
    patient_id: int
    patient_name: str
    urgency_score: int
    waiting_minutes: int
    reasons: List[MatchReason]


class AllocationResult(BaseModel):
    success: bool
    message: str
    resource: Optional[ResourceOut] = None
    patient: Optional[PatientOut] = None


class AutoAllocateResult(BaseModel):
    allocated: int
    message: str
