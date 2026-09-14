export type ResourceType = "bed" | "theatre" | "staff";
export type ResourceStatus = "available" | "committed";
export type PatientStatus = "waiting" | "admitted" | "discharged";

export interface Resource {
  id: number;
  type: ResourceType;
  name: string;
  status: ResourceStatus;
  version: number;
  updated_at: string;
}

export interface Patient {
  id: number;
  name: string;
  status: PatientStatus;
  resource_type_needed: ResourceType;
  urgency_score: number;
  waiting_since: string;
  current_resource_id: number | null;
}

export interface HospitalEvent {
  id: number;
  patient_id: number | null;
  resource_id: number | null;
  event_type: string;
  note: string | null;
  created_at: string;
}

export interface MatchReason {
  label: string;
  detail: string;
}

export interface MatchRecommendation {
  resource_id: number;
  resource_name: string;
  resource_type: ResourceType;
  patient_id: number;
  patient_name: string;
  urgency_score: number;
  waiting_minutes: number;
  reasons: MatchReason[];
}

export interface AllocationResult {
  success: boolean;
  message: string;
  resource?: Resource;
  patient?: Patient;
}

export interface AutoAllocateResult {
  allocated: number;
  message: string;
}

export interface NewPatientInput {
  name: string;
  resource_type_needed: ResourceType;
  urgency_score: number;
}
