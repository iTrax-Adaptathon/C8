import { AlertTriangle, ArrowRight, CheckCircle2, Clock, Loader2, Sparkles, UserCheck } from "lucide-react";
import { useState } from "react";

import { useAllocate, useMatches, useReserveResource } from "../hooks/useHospitalData";
import { cn, patientCode } from "../lib/utils";
import type { MatchRecommendation, MatchReason } from "../types/hospital";

function ReasonList({ reasons }: { reasons: MatchReason[] }) {
  return (
    <ul className="space-y-1.5 pt-1">
      {reasons.map((reason) => (
        <li key={reason.label} className="flex items-start gap-2 text-xs leading-relaxed">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
          <div>
            <span className="font-semibold text-slate-800">{reason.label}</span>:{" "}
            <span className="text-slate-600">{reason.detail}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function MatchPanel({ onViewPatient }: { onViewPatient: (id: number) => void }) {
  const { data: matches = [] } = useMatches();
  const allocate = useAllocate();
  const reserve = useReserveResource();

  const [pendingId, setPendingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<
    Record<number, { tone: "ok" | "err"; text: string }>
  >({});

  async function handleReserve(recommendation: MatchRecommendation) {
    const resourceId = recommendation.resource_id;
    setPendingId(resourceId);
    try {
      const result = await reserve.mutateAsync({
        resourceId,
        patientId: recommendation.patient_id,
        reason: `Matched & reserved via recommendation engine.`,
      });
      setFeedback((current) => ({
        ...current,
        [resourceId]: { tone: "ok", text: result.message },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Reservation failed.";
      setFeedback((current) => ({
        ...current,
        [resourceId]: { tone: "err", text: message },
      }));
    } finally {
      setPendingId(null);
    }
  }

  async function handleAllocate(recommendation: MatchRecommendation) {
    const resourceId = recommendation.resource_id;
    setPendingId(resourceId);
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
    <section className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs">
      <div className="mb-4 flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-600">
          <Sparkles size={16} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900">Explainable Matching Recommendation</h2>
          <p className="text-xs text-slate-500">
            Multi-criteria matching: Acuity → Wait Time → Qualified Staff → Arrival Window
          </p>
        </div>
      </div>

      {!primary ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
          <p className="text-sm font-medium text-slate-600">No active match available right now</p>
          <p className="mt-1 text-xs text-slate-400">
            Recommendations appear when queued patients and compatible resources align with verified qualified staff.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4.5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-white px-3 py-1.5 shadow-xs border border-slate-200">
                <p className="text-xs font-bold text-slate-900">{primary.patient_name}</p>
                <p className="text-[11px] text-slate-400">
                  {patientCode(primary.patient_id)} • Severity {primary.severity ?? "Medium"}
                </p>
              </div>
              <ArrowRight className="text-blue-500" size={16} />
              <div className="rounded-lg bg-white px-3 py-1.5 shadow-xs border border-slate-200">
                <p className="text-xs font-bold text-slate-900">{primary.resource_name}</p>
                <p className="text-[11px] capitalize text-slate-400">
                  {primary.resource_type} • Available
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleReserve(primary)}
                disabled={pendingId === primary.resource_id}
                className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-xs hover:bg-blue-50 disabled:opacity-50"
              >
                Pre-Reserve
              </button>
              <button
                onClick={() => handleAllocate(primary)}
                disabled={pendingId === primary.resource_id}
                className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
              >
                {pendingId === primary.resource_id && <Loader2 size={12} className="animate-spin" />}
                Confirm Allocation
              </button>
            </div>
          </div>

          {feedback[primary.resource_id] && (
            <div
              className={cn(
                "rounded-lg p-2.5 text-xs font-medium",
                feedback[primary.resource_id].tone === "ok"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-rose-50 text-rose-800 border border-rose-200",
              )}
            >
              {feedback[primary.resource_id].text}
            </div>
          )}

          {/* Explainable Checklist */}
          <div className="rounded-lg bg-white p-3.5 border border-slate-100 shadow-2xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Why this recommendation:
            </h4>
            <ReasonList reasons={primary.reasons} />
          </div>
        </div>
      )}
    </section>
  );
}
