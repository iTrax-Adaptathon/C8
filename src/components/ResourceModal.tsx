import { AlertTriangle, ArrowRightLeft, CheckCircle2, Loader2, Lock, LogOut, Unlock } from "lucide-react";
import { useEffect, useState } from "react";

import { useAllocate, useDischarge, useRelease, useTransfer } from "../hooks/useHospitalData";
import { cn, humanWait, isIcuBed, isWardBed, minutesSince, patientCode, urgencyTone } from "../lib/utils";
import type { Patient, Resource } from "../types/hospital";
import { Modal } from "./Modal";
import { StatusPill } from "./StatusPill";

export function ResourceModal({
  resource,
  resources,
  waiting,
  patients,
  onClose,
  onViewPatient,
}: {
  resource: Resource | null;
  resources: Resource[];
  waiting: Patient[];
  patients: Patient[];
  onClose: () => void;
  onViewPatient: (id: number) => void;
}) {
  const allocate = useAllocate();
  const release = useRelease();
  const discharge = useDischarge();
  const transfer = useTransfer();
  const [selectedPatient, setSelectedPatient] = useState<number | "">("");
  const [selectedTarget, setSelectedTarget] = useState<number | "">("");
  const [feedback, setFeedback] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [link, setLink] = useState<{ resourceId: number; patientId: number | null } | null>(null);

  const isOpen = resource !== null;
  const compatible = resource
    ? waiting.filter((patient) => patient.resource_type_needed === resource.type)
    : [];
  const assignedPatient = resource
    ? patients.find((patient) => patient.current_resource_id === resource.id) ?? null
    : null;
  const historyPatientId = link?.patientId ?? assignedPatient?.id ?? null;

  // Care path: ICU beds step down to a ward bed, theatre steps down to ICU.
  const targetKind: "ward" | "icu" | null = resource
    ? resource.type === "theatre"
      ? "icu"
      : isIcuBed(resource)
        ? "ward"
        : null
    : null;
  const transferTargets =
    resource && targetKind
      ? resources.filter((item) =>
          targetKind === "icu" ? isIcuBed(item) : isWardBed(item),
        ).filter((item) => item.status === "available")
      : [];
  const effectiveTarget: number | "" =
    selectedTarget !== "" && transferTargets.some((item) => item.id === selectedTarget)
      ? selectedTarget
      : (transferTargets[0]?.id ?? "");

  useEffect(() => {
    if (!resource) return;
    setFeedback(null);
    setSelectedPatient(compatible[0]?.id ?? "");
    setSelectedTarget("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource?.id, resource?.status]);

  if (!resource) return null;

  const pending =
    allocate.isPending || release.isPending || discharge.isPending || transfer.isPending;
  const canStepDown = assignedPatient !== null && targetKind !== null;

  async function handleAllocate() {
    setFeedback(null);
    try {
      const result = await allocate.mutateAsync({
        resourceId: resource!.id,
        patientId: selectedPatient === "" ? undefined : Number(selectedPatient),
      });
      setLink({ resourceId: resource!.id, patientId: result.patient?.id ?? null });
      setFeedback({ tone: "ok", text: result.message });
    } catch (error) {
      setFeedback({
        tone: "err",
        text: error instanceof Error ? error.message : "Allocation failed.",
      });
    }
  }

  async function handleRelease() {
    setFeedback(null);
    try {
      await release.mutateAsync(resource!.id);
      setFeedback({ tone: "ok", text: `${resource!.name} released back to available.` });
    } catch (error) {
      setFeedback({
        tone: "err",
        text: error instanceof Error ? error.message : "Release failed.",
      });
    }
  }

  async function handleDischarge() {
    if (!assignedPatient) return;
    setFeedback(null);
    try {
      await discharge.mutateAsync(assignedPatient.id);
      setFeedback({ tone: "ok", text: `${assignedPatient.name} discharged.` });
    } catch (error) {
      setFeedback({
        tone: "err",
        text: error instanceof Error ? error.message : "Discharge failed.",
      });
    }
  }

  async function handleTransfer() {
    if (!assignedPatient || effectiveTarget === "") return;
    setFeedback(null);
    try {
      await transfer.mutateAsync({
        patientId: assignedPatient.id,
        targetResourceId: Number(effectiveTarget),
      });
      setFeedback({ tone: "ok", text: `${assignedPatient.name} transferred.` });
    } catch (error) {
      setFeedback({
        tone: "err",
        text: error instanceof Error ? error.message : "Transfer failed.",
      });
    }
  }

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={resource.name}
      subtitle={`${resource.type} resource`}
    >
      <div className="mb-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
        <div>
          <p className="text-xs text-slate-400">Current status</p>
          <p className="text-sm font-semibold capitalize text-slate-700">{resource.status}</p>
        </div>
        <StatusPill status={resource.status} />
      </div>

      {resource.status === "available" ? (
        <div className="space-y-4">
          <div>
            <label className="label-muted mb-1.5 block">Assign to waiting patient</label>
            {compatible.length === 0 ? (
              <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
                No waiting patient currently needs a {resource.type}.
              </p>
            ) : (
              <select
                className="w-full rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 ring-1 ring-slate-200 focus:ring-2 focus:ring-teal-500"
                value={selectedPatient}
                onChange={(event) =>
                  setSelectedPatient(event.target.value === "" ? "" : Number(event.target.value))
                }
              >
                {compatible.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patientCode(patient.id)} · {patient.name} · urgency {patient.urgency_score}
                  </option>
                ))}
              </select>
            )}
          </div>
          <button
            className="btn-primary w-full justify-center"
            disabled={pending || compatible.length === 0}
            onClick={handleAllocate}
          >
            {allocate.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Lock size={16} />
            )}
            Allocate resource
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
            <p className="label-muted mb-2">Assigned patient</p>
            {assignedPatient ? (
              <dl className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-400">Patient ID</dt>
                  <dd className="font-semibold text-slate-700">
                    {patientCode(assignedPatient.id)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-400">Name</dt>
                  <dd className="font-semibold text-slate-700">{assignedPatient.name}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-400">Status</dt>
                  <dd className="capitalize text-slate-700">{assignedPatient.status}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-400">Required resource</dt>
                  <dd className="capitalize text-slate-700">
                    {assignedPatient.resource_type_needed}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-400">Urgency</dt>
                  <dd>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1",
                        urgencyTone(assignedPatient.urgency_score),
                      )}
                    >
                      {assignedPatient.urgency_score}
                    </span>
                  </dd>
                </div>
                {assignedPatient.status === "waiting" && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-slate-400">Waiting time</dt>
                    <dd className="text-slate-700">
                      {humanWait(minutesSince(assignedPatient.waiting_since))}
                    </dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-sm text-slate-500">Patient details unavailable</p>
            )}
          </div>
          {assignedPatient && (resource.type === "bed" || resource.type === "theatre") ? (
            <div className="space-y-3">
              <button
                className="btn-primary w-full justify-center"
                disabled={pending}
                onClick={handleDischarge}
              >
                {discharge.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <LogOut size={16} />
                )}
                Discharge patient
              </button>

              {canStepDown &&
                (transferTargets.length === 0 ? (
                  <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
                    No available {targetKind === "icu" ? "ICU" : "ward"} bed to discharge to right
                    now.
                  </p>
                ) : (
                  <div className="space-y-2 rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
                    <label className="label-muted block">
                      Discharge to {targetKind === "icu" ? "ICU" : "ward"} bed
                    </label>
                    <select
                      className="w-full rounded-xl border-0 bg-white px-3 py-2.5 text-sm text-slate-700 ring-1 ring-slate-200 focus:ring-2 focus:ring-teal-500"
                      value={effectiveTarget}
                      onChange={(event) => setSelectedTarget(Number(event.target.value))}
                    >
                      {transferTargets.map((target) => (
                        <option key={target.id} value={target.id}>
                          {target.name}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn-ghost w-full justify-center"
                      disabled={pending}
                      onClick={handleTransfer}
                    >
                      {transfer.isPending ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <ArrowRightLeft size={16} />
                      )}
                      Discharge to {targetKind === "icu" ? "ICU" : "ward"} bed
                    </button>
                  </div>
                ))}
            </div>
          ) : (
            <>
              <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-100">
                This resource is committed. Releasing it returns it to <strong>available</strong> and
                appends a release event to the audit trail. History is never deleted.
              </div>
              <button
                className="btn-ghost w-full justify-center"
                disabled={pending}
                onClick={handleRelease}
              >
                {release.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Unlock size={16} />
                )}
                Release resource
              </button>
            </>
          )}
        </div>
      )}

      {feedback && (
        <p
          className={cn(
            "mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm",
            feedback.tone === "ok"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700",
          )}
        >
          {feedback.tone === "ok" ? (
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          )}
          {feedback.text}
        </p>
      )}

      {historyPatientId != null && (
        <button
          className="mt-3 text-sm font-medium text-teal-600 hover:text-teal-700"
          onClick={() => onViewPatient(historyPatientId)}
        >
          View {patientCode(historyPatientId)} history →
        </button>
      )}
    </Modal>
  );
}
