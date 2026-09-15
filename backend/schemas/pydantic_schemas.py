"""Pydantic request/response models for the REST API."""
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

ResourceType = Literal["bed", "theatre", "staff"]
ResourceStatus = Literal["available", "reserved", "committed"]
PatientStatus = Literal[
    "en_route", "arrived", "waiting", "reserved", "admitted", "discharge_pending", "discharged"
]
SeverityLevel = Literal["Critical", "High", "Medium", "Low"]
AmbulanceStatus = Literal["En Route", "Arrived", "Cancelled"]
StaffAvailability = Literal["available", "busy", "on_break", "off_shift"]


class ResourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str
    name: str
    status: str
    version: int
    updated_at: datetime
    reserved_for_patient_id: Optional[int] = None
    department: Optional[str] = None
    specialty: Optional[str] = None
    role: Optional[str] = None
    shift: Optional[str] = None
    availability: Optional[str] = "available"
    workload: int = 0


class PatientCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    age: Optional[int] = Field(default=None, ge=0, le=130)
    resource_type_needed: ResourceType
    urgency_score: int = Field(default=3, ge=1, le=10)
    severity: Optional[SeverityLevel] = "Medium"
    department: Optional[str] = None
    specialty_needed: Optional[str] = None
    ambulance_id: Optional[str] = None
    eta_minutes: Optional[int] = None
    estimated_treatment_minutes: Optional[int] = Field(default=None, ge=1, le=1440)
    status: Optional[PatientStatus] = "waiting"


class PatientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    age: Optional[int] = None
    status: str
    resource_type_needed: str
    urgency_score: int
    waiting_since: datetime
    current_resource_id: Optional[int] = None
    severity: str = "Medium"
    department: Optional[str] = None
    specialty_needed: Optional[str] = None
    assigned_staff_id: Optional[int] = None
    ambulance_id: Optional[str] = None
    eta_minutes: Optional[int] = None
    estimated_treatment_minutes: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    waiting_minutes: Optional[int] = 0


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: Optional[int] = None
    resource_id: Optional[int] = None
    event_type: str
    staff_name: Optional[str] = None
    reason: Optional[str] = None
    note: Optional[str] = None
    previous_state: Optional[str] = None
    new_state: Optional[str] = None
    actor: Optional[str] = None
    created_at: datetime


class ResourceStatusUpdate(BaseModel):
    status: ResourceStatus
    note: Optional[str] = None


class AllocateRequest(BaseModel):
    patient_id: Optional[int] = None
    staff_name: Optional[str] = None
    reason: Optional[str] = None


class ReserveRequest(BaseModel):
    patient_id: int
    staff_name: Optional[str] = None
    reason: Optional[str] = None


class TransferRequest(BaseModel):
    target_resource_id: int
    staff_name: Optional[str] = None
    reason: Optional[str] = None


class DischargeRequest(BaseModel):
    staff_name: Optional[str] = None
    reason: Optional[str] = None


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
    severity: Optional[str] = "Medium"
    reasons: List[MatchReason]


class AllocationResult(BaseModel):
    success: bool
    message: str
    resource: Optional[ResourceOut] = None
    patient: Optional[PatientOut] = None


class AutoAllocateResult(BaseModel):
    allocated: int
    message: str


# ------------------------------------------------ Ambulance Models
class AmbulanceCreate(BaseModel):
    ambulance_code: str = Field(min_length=2, max_length=20)
    eta_minutes: int = Field(ge=0, le=300)
    severity: SeverityLevel
    required_resource: str  # ICU Bed | Emergency Bed | Ward Bed | Theatre
    patient_name: Optional[str] = None


class AmbulanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ambulance_code: str
    patient_name: Optional[str] = None
    eta_minutes: int
    severity: str
    required_resource: str
    status: str
    patient_id: Optional[int] = None
    reserved_resource_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class AmbulanceReserveRequest(BaseModel):
    resource_id: int
    staff_name: Optional[str] = "Operations Desk"


# ------------------------------------------------ Theatre Models
class TheatreBookingCreate(BaseModel):
    theatre_id: int
    patient_id: Optional[int] = None
    surgery_name: str
    required_specialty: str
    required_staff: Optional[str] = None
    start_time: datetime
    duration_minutes: int = Field(ge=15, le=720)


class TheatreBookingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    theatre_id: int
    theatre_name: Optional[str] = None
    patient_id: Optional[int] = None
    patient_name: Optional[str] = None
    surgery_name: str
    required_specialty: str
    required_staff: Optional[str] = None
    start_time: datetime
    end_time: datetime
    duration_minutes: int
    status: str


# ------------------------------------------------ Staff Models
class StaffUpdate(BaseModel):
    availability: Optional[StaffAvailability] = None
    shift: Optional[str] = None
    workload: Optional[int] = None


class StaffMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    role: Optional[str] = "Clinician"
    specialty: Optional[str] = "General"
    department: Optional[str] = "General"
    shift: Optional[str] = "Day Shift"
    availability: str = "available"
    workload: int = 0
    assigned_patients_count: int = 0


# ------------------------------------------------ Bottlenecks & Dashboard
class BottleneckOut(BaseModel):
    id: str
    title: str
    detail: str
    severity: SeverityLevel
    category: str  # bed | staff | theatre | wait_time


class DashboardSummaryOut(BaseModel):
    beds_available: int
    beds_total: int
    staff_available: int
    staff_total: int
    ambulances_en_route: int
    critical_bottlenecks: int
    patient_flow: dict  # {"en_route": int, "waiting": int, "reserved": int, "admitted": int, "discharge_pending": int}
    incoming_ambulances: List[AmbulanceOut]
    alerts: List[BottleneckOut]
    recent_patients: List[PatientOut]
