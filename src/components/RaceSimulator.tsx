import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldAlert, Swords } from "lucide-react";
import { useMemo, useState } from "react";

import { useResources, useWaiting } from "../hooks/useHospitalData";
import { cn, patientCode } from "../lib/utils";
import { api, ApiError } from "../services/api";

interface AttemptResult {
  label: string;
  status: "success" | "conflict" | "error";
  detail: string;
}

export function RaceSimulator() {
  const { data: resources = [] } = useResources();
  const { data: waiting = [] } = useWaiting();
  const client = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<AttemptResult[] | null>(null);

  const candidates = useMemo(
    () =>
      resources.filter(
        (resource) =>
          resource.status === "available" &&
          waiting.some((patient) => patient.resource_type_needed === resource.type),
      ),
    [resources, waiting],
  );

  const resourceId = selectedId ?? candidates[0]?.id ?? null;
  const target = resources.find((resource) => resource.id === resourceId);
  const candidatePatient = waiting.find(
    (patient) => patient.resource_type_needed === target?.type,
  );

  async function runRace() {
    if (resourceId === null) return;
    setRunning(true);
    setResults(null);
    try {
      const settled = await Promise.allSettled([api.allocate(resourceId), api.allocate(resourceId)]);
      const mapped: AttemptResult[] = settled.map((outcome, index) => {
        const label = index === 0 ? "Request A" : "Request B";
        if (outcome.status === "fulfilled") {
          return { label, status: "success", detail: outcome.value.message };
        }
        const reason = outcome.reason;
        if (reason instanceof ApiError && reason.status === 409) {
          return { label, status: "conflict", detail: reason.message };
        }
        return {
          label,
          status: "error",
          detail: reason instanceof Error ? reason.message : "Unexpected error",
        };
      });
      setResults(mapped);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["resources"] }),
        client.invalidateQueries({ queryKey: ["waiting"] }),
        client.invalidateQueries({ queryKey: ["matches"] }),
        client.invalidateQueries({ queryKey: ["events"] }),
      ]);
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="card">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-red-600">
          <Swords size={16} />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Double-booking guard · AC-5</h2>
          <p className="text-xs text-slate-400">
            Fire two simultaneous allocations at one resource — only one can win
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="label-muted mb-1.5 block">Available resource with a matching patient</label>
          <select
            className="w-full rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 ring-1 ring-slate-200 focus:ring-2 focus:ring-teal-500"
            value={resourceId ?? ""}
            onChange={(event) => setSelectedId(Number(event.target.value))}
            disabled={candidates.length === 0 || running}
          >
            {candidates.length === 0 ? (
              <option value="">No allocatable resource right now</option>
            ) : (
              candidates.map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.name}
                </option>
              ))
            )}
          </select>
        </div>
        <button
          className="btn-primary shrink-0 justify-center !bg-red-600 hover:!bg-red-700"
          disabled={running || resourceId === null}
          onClick={runRace}
        >
          {running ? <Loader2 size={16} className="animate-spin" /> : <ShieldAlert size={16} />}
          Fire 2 concurrent allocations
        </button>
      </div>

      {candidatePatient && target && (
        <p className="mt-2 text-xs text-slate-400">
          Both requests race for <strong className="text-slate-600">{target.name}</strong>; the top
          candidate is {patientCode(candidatePatient.id)} {candidatePatient.name}.
        </p>
      )}

      {results && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {results.map((result) => (
            <div
              key={result.label}
              className={cn(
                "rounded-xl px-3.5 py-3 text-sm ring-1",
                result.status === "success"
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                  : result.status === "conflict"
                    ? "bg-amber-50 text-amber-700 ring-amber-100"
                    : "bg-red-50 text-red-700 ring-red-100",
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                {result.label} ·{" "}
                {result.status === "success"
                  ? "200 OK"
                  : result.status === "conflict"
                    ? "409 Conflict"
                    : "Error"}
              </p>
              <p className="mt-1">{result.detail}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
