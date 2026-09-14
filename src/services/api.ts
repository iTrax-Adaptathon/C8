import type {
  AllocationResult,
  AutoAllocateResult,
  HospitalEvent,
  MatchRecommendation,
  NewPatientInput,
  Patient,
  Resource,
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

  getResources: () => request<Resource[]>("/resources"),
  getWaiting: () => request<Patient[]>("/patients/waiting"),
  getPatients: () => request<Patient[]>("/patients"),
  getMatches: () => request<MatchRecommendation[]>("/matches"),
  getRecentEvents: (limit = 40) => request<HospitalEvent[]>(`/events/recent?limit=${limit}`),
  getHistory: (patientId: number) =>
    request<HospitalEvent[]>(`/patients/${patientId}/history`),

  createPatient: (input: NewPatientInput) =>
    request<Patient>("/patients", { method: "POST", body: JSON.stringify(input) }),

  allocate: (resourceId: number, patientId?: number) =>
    request<AllocationResult>(`/resources/${resourceId}/allocate`, {
      method: "POST",
      body: JSON.stringify(patientId ? { patient_id: patientId } : {}),
    }),

  release: (resourceId: number) =>
    request<Resource>(`/resources/${resourceId}/release`, { method: "POST" }),

  discharge: (patientId: number) =>
    request<Patient>(`/patients/${patientId}/discharge`, { method: "POST" }),

  transfer: (patientId: number, targetResourceId: number) =>
    request<Patient>(`/patients/${patientId}/transfer`, {
      method: "POST",
      body: JSON.stringify({ target_resource_id: targetResourceId }),
    }),

  autoAllocate: () =>
    request<AutoAllocateResult>("/allocations/auto-allocate", { method: "POST" }),
};

export { API_BASE };
