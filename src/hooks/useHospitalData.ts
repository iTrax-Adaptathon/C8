import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import { api } from "../services/api";
import type {
  NewAmbulanceInput,
  NewPatientInput,
  NewResourceInput,
  NewTheatreBookingInput,
} from "../types/hospital";

/** Near-real-time polling interval */
export const POLL_INTERVAL_MS = 2500;

function invalidateAll(client: QueryClient) {
  for (const key of [
    "dashboard",
    "resources",
    "waiting",
    "patients",
    "ambulances",
    "theatres",
    "theatre_bookings",
    "staff",
    "matches",
    "events",
  ]) {
    client.invalidateQueries({ queryKey: [key] });
  }
  client.invalidateQueries({ queryKey: ["history"] });
}

// ------------------------------------------------ Dashboard
export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: api.getDashboardSummary,
    refetchInterval: POLL_INTERVAL_MS,
  });
}

// ------------------------------------------------ Resources & Reservations
export function useResources(type?: string) {
  return useQuery({
    queryKey: ["resources", type],
    queryFn: () => api.getResources(type),
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function useCreateResources() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: NewResourceInput) => api.createResources(input),
    onSettled: () => invalidateAll(client),
  });
}

export function useRemoveResource() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (resourceId: number) => api.removeResource(resourceId),
    onSettled: () => invalidateAll(client),
  });
}

export function useReserveResource() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      resourceId,
      patientId,
      staffName,
      reason,
    }: {
      resourceId: number;
      patientId: number;
      staffName?: string;
      reason?: string;
    }) => api.reserveResource(resourceId, patientId, staffName, reason),
    onSettled: () => invalidateAll(client),
  });
}

export function useCancelReservation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (resourceId: number) => api.cancelReservation(resourceId),
    onSettled: () => invalidateAll(client),
  });
}

export function useAllocate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      resourceId,
      patientId,
      staffName,
      reason,
    }: {
      resourceId: number;
      patientId?: number;
      staffName?: string;
      reason?: string;
    }) => api.allocate(resourceId, patientId, staffName, reason),
    onSettled: () => invalidateAll(client),
  });
}

export function useRelease() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (resourceId: number) => api.release(resourceId),
    onSettled: () => invalidateAll(client),
  });
}

// ------------------------------------------------ Patients
export function useWaiting() {
  return useQuery({
    queryKey: ["waiting"],
    queryFn: api.getWaiting,
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function usePatients(status?: string) {
  return useQuery({
    queryKey: ["patients", status],
    queryFn: () => api.getPatients(status),
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function usePatient(id: number | null) {
  return useQuery({
    queryKey: ["patients", id],
    queryFn: () => api.getPatient(id as number),
    enabled: id !== null,
  });
}

export function useCreatePatient() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: NewPatientInput) => api.createPatient(input),
    onSettled: () => invalidateAll(client),
  });
}

export function useMarkDischargePending() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ patientId, staffName, reason }: { patientId: number; staffName?: string; reason?: string }) =>
      api.markDischargePending(patientId, staffName, reason),
    onSettled: () => invalidateAll(client),
  });
}

export function useDischarge() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ patientId, staffName, reason }: { patientId: number; staffName?: string; reason?: string }) =>
      api.discharge(patientId, staffName, reason),
    onSettled: () => invalidateAll(client),
  });
}

export function useTransfer() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      patientId,
      targetResourceId,
    }: {
      patientId: number;
      targetResourceId: number;
    }) => api.transfer(patientId, targetResourceId),
    onSettled: () => invalidateAll(client),
  });
}

// ------------------------------------------------ Ambulances
export function useAmbulances(status?: string) {
  return useQuery({
    queryKey: ["ambulances", status],
    queryFn: () => api.getAmbulances(status),
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function useCreateAmbulance() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: NewAmbulanceInput) => api.createAmbulance(input),
    onSettled: () => invalidateAll(client),
  });
}

export function useReserveAmbulance() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ ambulanceId, resourceId }: { ambulanceId: number; resourceId: number }) =>
      api.reserveAmbulance(ambulanceId, resourceId),
    onSettled: () => invalidateAll(client),
  });
}

export function useArriveAmbulance() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ambulanceId: number) => api.arriveAmbulance(ambulanceId),
    onSettled: () => invalidateAll(client),
  });
}

export function useCancelAmbulance() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ambulanceId: number) => api.cancelAmbulance(ambulanceId),
    onSettled: () => invalidateAll(client),
  });
}

// ------------------------------------------------ Theatres
export function useTheatres() {
  return useQuery({
    queryKey: ["theatres"],
    queryFn: api.getTheatres,
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function useTheatreBookings(theatreId?: number) {
  return useQuery({
    queryKey: ["theatre_bookings", theatreId],
    queryFn: () => api.getTheatreBookings(theatreId),
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function useCreateTheatreBooking() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: NewTheatreBookingInput) => api.createTheatreBooking(input),
    onSettled: () => invalidateAll(client),
  });
}

// ------------------------------------------------ Staff
export function useStaff() {
  return useQuery({
    queryKey: ["staff"],
    queryFn: api.getStaff,
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function useUpdateStaff() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      staffId,
      input,
    }: {
      staffId: number;
      input: { availability?: string; shift?: string; workload?: number };
    }) => api.updateStaff(staffId, input),
    onSettled: () => invalidateAll(client),
  });
}

// ------------------------------------------------ Matching & Events
export function useMatches() {
  return useQuery({
    queryKey: ["matches"],
    queryFn: api.getMatches,
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function useRecentEvents() {
  return useQuery({
    queryKey: ["events"],
    queryFn: () => api.getRecentEvents(50),
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function useHistory(patientId: number | null) {
  return useQuery({
    queryKey: ["history", patientId],
    queryFn: () => api.getHistory(patientId as number),
    enabled: patientId !== null,
  });
}

export function useAutoAllocateQueue() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.autoAllocate,
    onSuccess: (result) => {
      if (result.allocated > 0) invalidateAll(client);
    },
  });
}
