import { AlertTriangle, ArrowRightLeft, CheckCircle2, Loader2, Lock, LogOut, Unlock, Bookmark } from "lucide-react";
import { useEffect, useState } from "react";

import { useAllocate, useCancelReservation, useDischarge, useRelease, useReserveResource, useTransfer } from "../hooks/useHospitalData";
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
  const reserve = useReserveResource();
  const cancelReservation = useCancelReservation();
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
  }, [resource?.id, resource?.status]);

  if (!resource) return null;

  const pending =
    allocate.isPending || reserve.isPending || cancelReservation.isPending || release.isPending || discharge.isPending || transfer.isPending;
  const canStepDown = assignedPatient !== null && targetKind !== null;

  async function handleReserve() {
    setFeedback(null);
    if (!selectedPatient) return;
    try {
      const result = await reserve.mutateAsync({
        resourceId: resource!.id,
        patientId: Number(selectedPatient),
      });
      setFeedback({ tone: "ok", text: result.message });
    } catch (error) {
      setFeedback({
        tone: "err",
        text: error instanceof Error ? error.message : "Reservation failed.",
      });
    }
  }

  async function handleCancelReservation() {
    setFeedback(null);
    try {
      const result = await cancelReservation.mutateAsync(resource!.id);
      setFeedback({ tone: "ok", text: result.message });
    } catch (error) {
      setFeedback({
        tone: "err",
        text: error instanceof Error ? error.message : "Cancel reservation failed.",
      });
    }
  }

  async function handleAllocate() {
    setFeedback(null);
    try {
      const result = await allocate.mutateAsync({
        resourceId: resource!.id,
        patientId: selectedPatient === "" ? (assignedPatient ? assignedPatient.id : undefined) : Number(selectedPatient),
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
      await discharge.mutateAsync({ patientId: assignedPatient.id });
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
      subtitle={`${resource.type} resource · ${resource.department ?? "General"}`}
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
            <label className="label-muted mb-1.5 block">Assign to waiting/incoming patient</label>
            {compatible.length === 0 ? (
              <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
                No waiting patient currently needs a {resource.type}.
              </p>
            ) : (
              <select
                className="w-full rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500"
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
          <div className="flex gap-2">
            <button
              className="flex-1 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              disabled={pending || compatible.length === 0}
              onClick={handleReserve}
            >
              <Bookmark size={15} /> Pre-Reserve
            </button>
            <button
              className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              disabled={pending || compatible.length === 0}
              onClick={handleAllocate}
            >
              <Lock size={15} /> Confirm &amp; Admit
            </button>
          </div>
        </div>
      ) : resource.status === "reserved" ? (
        <div className="space-y-4">
          <div className="rounded-xl bg-purple-50 p-4 border border-purple-200 text-xs text-purple-900 space-y-1">
            <p className="font-bold text-sm">Resource is Currently Reserved</p>
            <p>Locked for {assignedPatient ? assignedPatient.name : "incoming emergency patient"}.</p>
          </div>
          <div className="flex gap-2">
            <button
              className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              disabled={pending}
              onClick={handleAllocate}
            >
              <CheckCircle2 size={15} /> Complete Admission
            </button>
            <button
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              disabled={pending}
              onClick={handleCancelReservation}
            >
              <Unlock size={15} /> Cancel Reservation
            </button>
          </div>
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
                  <dt className="text-slate-400">Urgency score</dt>
                  <dd>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1",
                        urgencyTone(assignedPatient.urgency_score),
                      )}
                    >
                      {assignedPatient.urgency_score}
                    </span>
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-slate-500">Occupied / committed without patient pointer.</p>
            )}
          </div>

          <div className="flex gap-2">
            {assignedPatient && (
              <button
                className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                disabled={pending}
                onClick={handleDischarge}
              >
                <LogOut size={15} /> Discharge &amp; Free Bed
              </button>
            )}
            <button
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              disabled={pending}
              onClick={handleRelease}
            >
              <Unlock size={15} /> Manual Release
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <div
          className={cn(
            "mt-4 rounded-xl px-4 py-3 text-sm",
            feedback.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700",
          )}
        >
          {feedback.text}
        </div>
      )}
    </Modal>
  );
}
