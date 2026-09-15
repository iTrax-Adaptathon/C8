import type {
  AllocationResult,
  Ambulance,
  AutoAllocateResult,
  DashboardSummary,
  HospitalEvent,
  MatchRecommendation,
  NewAmbulanceInput,
  NewPatientInput,
  NewResourceInput,
  NewTheatreBookingInput,
  Patient,
  Resource,
  StaffMember,
  TheatreBooking,
} from "../types/hospital";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://127.0.0.1:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (body?.detail) {
        detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
      }
    } catch {
      /* response had no JSON body */
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  health: () => request<{ status: string }>("/health"),

  // Dashboard Summary (4 cards, flow counts, alerts, ambulances, recent patients)
  getDashboardSummary: () => request<DashboardSummary>("/dashboard/summary"),

  // Resources
  getResources: (type?: string) =>
    request<Resource[]>(`/resources${type ? `?type=${type}` : ""}`),
  getResource: (id: number) => request<Resource>(`/resources/${id}`),
  createResources: (input: NewResourceInput) =>
    request<Resource[]>("/resources", { method: "POST", body: JSON.stringify(input) }),
  removeResource: (resourceId: number) =>
    request<void>(`/resources/${resourceId}`, { method: "DELETE" }),
  reserveResource: (resourceId: number, patientId: number, staffName?: string, reason?: string) =>
    request<AllocationResult>(`/resources/${resourceId}/reserve`, {
      method: "POST",
      body: JSON.stringify({ patient_id: patientId, staff_name: staffName, reason }),
    }),
  cancelReservation: (resourceId: number) =>
    request<AllocationResult>(`/resources/${resourceId}/cancel-reservation`, {
      method: "POST",
    }),
  allocate: (resourceId: number, patientId?: number, staffName?: string, reason?: string) =>
    request<AllocationResult>(`/resources/${resourceId}/allocate`, {
      method: "POST",
      body: JSON.stringify({ patient_id: patientId, staff_name: staffName, reason }),
    }),
  release: (resourceId: number) =>
    request<Resource>(`/resources/${resourceId}/release`, { method: "POST" }),

  // Patients & Queue
  getWaiting: () => request<Patient[]>("/patients/waiting"),
  getPatients: (status?: string) =>
    request<Patient[]>(`/patients${status ? `?status=${status}` : ""}`),
  getPatient: (id: number) => request<Patient>(`/patients/${id}`),
  createPatient: (input: NewPatientInput) =>
    request<Patient>("/patients", { method: "POST", body: JSON.stringify(input) }),
  markDischargePending: (patientId: number, staffName?: string, reason?: string) =>
    request<Patient>(`/patients/${patientId}/discharge-pending`, {
      method: "POST",
      body: JSON.stringify({ staff_name: staffName, reason }),
    }),
  discharge: (patientId: number, staffName?: string, reason?: string) =>
    request<Patient>(`/patients/${patientId}/discharge`, {
      method: "POST",
      body: JSON.stringify({ staff_name: staffName, reason }),
    }),
  transfer: (patientId: number, targetResourceId: number) =>
    request<Patient>(`/patients/${patientId}/transfer`, {
      method: "POST",
      body: JSON.stringify({ target_resource_id: targetResourceId }),
    }),

  // Ambulances
  getAmbulances: (status?: string) =>
    request<Ambulance[]>(`/ambulances${status ? `?status=${status}` : ""}`),
  createAmbulance: (input: NewAmbulanceInput) =>
    request<Ambulance>("/ambulances", { method: "POST", body: JSON.stringify(input) }),
  reserveAmbulance: (ambulanceId: number, resourceId: number) =>
    request<Ambulance>(`/ambulances/${ambulanceId}/reserve`, {
      method: "POST",
      body: JSON.stringify({ resource_id: resourceId }),
    }),
  arriveAmbulance: (ambulanceId: number) =>
    request<Ambulance>(`/ambulances/${ambulanceId}/arrive`, { method: "POST" }),
  cancelAmbulance: (ambulanceId: number) =>
    request<Ambulance>(`/ambulances/${ambulanceId}/cancel`, { method: "POST" }),
  checkAmbulanceCapacity: (ambulanceId: number) =>
    request<{ available: boolean; expected_ready: boolean; message: string; candidate_resource?: string }>(
      `/ambulances/${ambulanceId}/capacity-check`,
    ),

  // Theatres
  getTheatres: () => request<Resource[]>("/theatres"),
  getTheatreBookings: (theatreId?: number) =>
    request<TheatreBooking[]>(`/theatres/bookings${theatreId ? `?theatre_id=${theatreId}` : ""}`),
  createTheatreBooking: (input: NewTheatreBookingInput) =>
    request<TheatreBooking>("/theatres/bookings", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  // Staff
  getStaff: () => request<StaffMember[]>("/resources/staff"),
  updateStaff: (staffId: number, input: { availability?: string; shift?: string; workload?: number }) =>
    request<Resource>(`/resources/staff/${staffId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  // Matching & Auto-allocate
  getMatches: () => request<MatchRecommendation[]>("/matches"),
  autoAllocate: () =>
    request<AutoAllocateResult>("/allocations/auto-allocate", { method: "POST" }),

  // Events / Audit
  getRecentEvents: (limit = 50) => request<HospitalEvent[]>(`/events/recent?limit=${limit}`),
  getHistory: (patientId: number) =>
    request<HospitalEvent[]>(`/patients/${patientId}/history`),
};

export { API_BASE };
