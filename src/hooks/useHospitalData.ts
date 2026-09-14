import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import { api } from "../services/api";
import type { NewPatientInput } from "../types/hospital";

/** Near-real-time via polling only - no WebSockets (out of scope). */
export const POLL_INTERVAL_MS = 2500;

function invalidateAll(client: QueryClient) {
  for (const key of ["resources", "waiting", "patients", "matches", "events"]) {
    client.invalidateQueries({ queryKey: [key] });
  }
  client.invalidateQueries({ queryKey: ["history"] });
}

export function useResources() {
  return useQuery({
    queryKey: ["resources"],
    queryFn: api.getResources,
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function useWaiting() {
  return useQuery({
    queryKey: ["waiting"],
    queryFn: api.getWaiting,
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function usePatients() {
  return useQuery({
    queryKey: ["patients"],
    queryFn: api.getPatients,
    refetchInterval: POLL_INTERVAL_MS,
  });
}

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
    queryFn: () => api.getRecentEvents(40),
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

export function useAllocate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ resourceId, patientId }: { resourceId: number; patientId?: number }) =>
      api.allocate(resourceId, patientId),
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

export function useDischarge() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patientId: number) => api.discharge(patientId),
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

/** Automatic mode: drain the waiting queue into compatible free resources. */
export function useAutoAllocateQueue() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.autoAllocate,
    onSuccess: (result) => {
      if (result.allocated > 0) invalidateAll(client);
    },
  });
}

export function useCreatePatient() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: NewPatientInput) => api.createPatient(input),
    onSettled: () => invalidateAll(client),
  });
}
