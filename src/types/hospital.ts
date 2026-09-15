export type ResourceType = "bed" | "theatre" | "staff";
export type ResourceStatus = "available" | "reserved" | "committed";
export type PatientStatus =
  | "en_route"
  | "arrived"
  | "waiting"
  | "reserved"
  | "admitted"
  | "discharge_pending"
  | "discharged";

export type SeverityLevel = "Critical" | "High" | "Medium" | "Low";
export type StaffAvailability = "available" | "busy" | "on_break" | "off_shift";

export interface Resource {
  id: number;
  type: ResourceType;
  name: string;
  status: ResourceStatus;
  version: number;
  updated_at: string;
  active?: boolean;
  reserved_for_patient_id?: number | null;
  department?: string | null;
  specialty?: string | null;
  role?: string | null;
  shift?: string | null;
  availability?: StaffAvailability;
  workload?: number;
}

export interface Patient {
  id: number;
  name: string;
  age?: number | null;
  status: PatientStatus;
  resource_type_needed: ResourceType;
  urgency_score: number;
  waiting_since: string;
  current_resource_id: number | null;
  severity?: SeverityLevel;
  department?: string | null;
  specialty_needed?: string | null;
  assigned_staff_id?: number | null;
  ambulance_id?: string | null;
  eta_minutes?: number | null;
  estimated_treatment_minutes?: number | null;
  created_at?: string;
  updated_at?: string;
  waiting_minutes?: number;
}

export interface Ambulance {
  id: number;
  ambulance_code: string;
  patient_name?: string | null;
  eta_minutes: number;
  severity: SeverityLevel;
  required_resource: string;
  status: "En Route" | "Arrived" | "Cancelled";
  patient_id: number | null;
  reserved_resource_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface TheatreBooking {
  id: number;
  theatre_id: number;
  theatre_name?: string | null;
  patient_id?: number | null;
  patient_name?: string | null;
  surgery_name: string;
  required_specialty: string;
  required_staff?: string | null;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  status: string;
}

export interface StaffMember {
  id: number;
  name: string;
  role: string;
  specialty: string;
  department: string;
  shift: string;
  availability: StaffAvailability;
  workload: number;
  assigned_patients_count: number;
}

export interface BottleneckAlert {
  id: string;
  title: string;
  detail: string;
  severity: SeverityLevel;
  category: "bed" | "staff" | "theatre" | "wait_time" | "ambulance";
}

export interface DashboardSummary {
  beds_available: number;
  beds_total: number;
  staff_available: number;
  staff_total: number;
  ambulances_en_route: number;
  critical_bottlenecks: number;
  patient_flow: {
    en_route: number;
    waiting: number;
    reserved: number;
    admitted: number;
    discharge_pending: number;
  };
  incoming_ambulances: Ambulance[];
  alerts: BottleneckAlert[];
  recent_patients: Patient[];
}

export interface HospitalEvent {
  id: number;
  patient_id: number | null;
  resource_id: number | null;
  event_type: string;
  staff_name?: string | null;
  reason?: string | null;
  note: string | null;
  previous_state?: string | null;
  new_state?: string | null;
  actor?: string | null;
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
  severity?: SeverityLevel;
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
  age?: number;
  resource_type_needed: ResourceType;
  urgency_score: number;
  severity?: SeverityLevel;
  department?: string;
  specialty_needed?: string;
  ambulance_id?: string;
  eta_minutes?: number;
  estimated_treatment_minutes?: number;
}

export interface NewResourceInput {
  type: "bed" | "staff";
  name: string;
  quantity: number;
  department?: string;
  specialty?: string;
  role?: string;
  shift?: string;
}

export interface NewAmbulanceInput {
  ambulance_code: string;
  eta_minutes: number;
  severity: SeverityLevel;
  required_resource: string;
  patient_name?: string;
}

export interface NewTheatreBookingInput {
  theatre_id: number;
  patient_id?: number;
  surgery_name: string;
  required_specialty: string;
  required_staff?: string;
  start_time: string;
  duration_minutes: number;
}
