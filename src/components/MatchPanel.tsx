import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";

import { useAllocate, useMatches } from "../hooks/useHospitalData";
import { cn, patientCode } from "../lib/utils";
import type { MatchRecommendation, MatchReason } from "../types/hospital";

function ReasonList({ reasons }: { reasons: MatchReason[] }) {
  return (
    <ul className="space-y-1.5">
      {reasons.map((reason) => (
        <li key={reason.label} className="flex items-start gap-2 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <span>
            <span className="font-medium text-slate-700">{reason.label}</span>
            <span className="text-slate-500"> · {reason.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function MatchPanel({ onViewPatient }: { onViewPatient: (id: number) => void }) {
  const { data: matches = [] } = useMatches();
  const allocate = useAllocate();
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<
    Record<number, { tone: "ok" | "err"; text: string }>
  >({});

  async function handleAllocate(recommendation: MatchRecommendation) {
    const resourceId = recommendation.resource_id;
    setPendingId(resourceId);
    setFeedback((current) => {
      const next = { ...current };
      delete next[resourceId];
      return next;
    });
    try {
      const result = await allocate.mutateAsync({
        resourceId,
        patientId: recommendation.patient_id,
      });
      setFeedback((current) => ({
        ...current,
        [resourceId]: { tone: "ok", text: result.message },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Allocation failed.";
      setFeedback((current) => ({
        ...current,
        [resourceId]: { tone: "err", text: message },
      }));
    } finally {
      setPendingId(null);
    }
  }

  const primary = matches[0];
  const rest = matches.slice(1);

  return (
    <section className="card">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-50 text-teal-600">
          <Sparkles size={16} />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Recommended Match</h2>
          <p className="text-xs text-slate-400">Explainable matching · urgency first, wait time second</p>
        </div>
      </div>

      {!primary ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center">
          <p className="text-sm font-medium text-slate-600">No match available right now</p>
          <p className="mt-1 text-xs text-slate-400">
            A recommendation appears when a waiting patient and a compatible available
            resource line up.
          </p>
        </div>
      ) : (
        <div className="animate-fade-slide rounded-2xl bg-gradient-to-br from-teal-50 to-white p-5 ring-1 ring-teal-100">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-100">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-600 text-xs font-bold text-white">
                {patientCode(primary.patient_id).slice(1)}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800">{primary.patient_name}</p>
                <p className="text-xs text-slate-400">{patientCode(primary.patient_id)}</p>
              </div>
            </div>
            <ArrowRight className="text-teal-500" size={18} />
            <div className="rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-100">
              <p className="text-sm font-semibold text-slate-800">{primary.resource_name}</p>
              <p className="text-xs capitalize text-slate-400">
                {primary.resource_type} · available
              </p>
            </div>
          </div>

          <div className="mt-4">
            <ReasonList reasons={primary.reasons} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              className="btn-primary"
              disabled={pendingId === primary.resource_id}
              onClick={() => handleAllocate(primary)}
            >
              {pendingId === primary.resource_id ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle2 size={16} />
              )}
              Allocate
            </button>
            <button className="btn-ghost" onClick={() => onViewPatient(primary.patient_id)}>
              View history
            </button>
          </div>

          {feedback[primary.resource_id] && (
            <p
              className={cn(
                "mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                feedback[primary.resource_id].tone === "ok"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700",
              )}
            >
              {feedback[primary.resource_id].tone === "err" && (
                <AlertTriangle size={15} className="shrink-0" />
              )}
              {feedback[primary.resource_id].text}
            </p>
          )}
        </div>
      )}

      {rest.length > 0 && (
        <div className="mt-4">
          <p className="label-muted mb-2">More recommendations</p>
          <div className="space-y-2">
            {rest.map((recommendation) => (
              <div
                key={recommendation.resource_id}
                className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100"
              >
                <button
                  className="min-w-0 text-left"
                  onClick={() => onViewPatient(recommendation.patient_id)}
                >
                  <p className="truncate text-sm font-medium text-slate-700">
                    {recommendation.patient_name}{" "}
                    <span className="text-slate-400">→ {recommendation.resource_name}</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    urgency {recommendation.urgency_score} · waiting{" "}
                    {recommendation.waiting_minutes} min
                  </p>
                </button>
                <button
                  className="btn-ghost shrink-0 !px-3 !py-1.5 text-xs"
                  disabled={pendingId === recommendation.resource_id}
                  onClick={() => handleAllocate(recommendation)}
                >
                  {pendingId === recommendation.resource_id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : null}
                  Allocate
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
