import { AlertTriangle, Loader2, UserPlus } from "lucide-react";
import { useState } from "react";

import { useAllocate, useCreatePatient, useResources } from "../hooks/useHospitalData";
import { cn } from "../lib/utils";
import type { ResourceType } from "../types/hospital";
import { Modal } from "./Modal";

const TYPES: ResourceType[] = ["bed", "theatre", "staff"];

export function AddPatientModal({
  open,
  onClose,
  onCreated,
  autoAllocate,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (patientId: number) => void;
  autoAllocate: boolean;
}) {
  const createPatient = useCreatePatient();
  const allocate = useAllocate();
  const { data: resources = [] } = useResources();
  const [name, setName] = useState("");
  const [type, setType] = useState<ResourceType>("bed");
  const [urgency, setUrgency] = useState(3);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setType("bed");
    setUrgency(3);
    setError(null);
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setError("Please enter a patient name.");
      return;
    }
    setError(null);
    try {
      const patient = await createPatient.mutateAsync({
        name: name.trim(),
        resource_type_needed: type,
        urgency_score: urgency,
      });
      if (autoAllocate && type === "bed") {
        const bed = resources.find(
          (resource) => resource.type === "bed" && resource.status === "available",
        );
        if (bed) {
          try {
            await allocate.mutateAsync({ resourceId: bed.id, patientId: patient.id });
          } catch {
            /* allocation is best-effort; patient stays in the waiting queue */
          }
        }
      }
      reset();
      onClose();
      onCreated?.(patient.id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not create patient.");
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Add Patient"
      subtitle="New patients enter the waiting queue immediately."
    >
      <div className="space-y-4">
        <div>
          <label className="label-muted mb-1.5 block">Patient name</label>
          <input
            autoFocus
            className="w-full rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 ring-1 ring-slate-200 focus:ring-2 focus:ring-teal-500"
            placeholder="e.g. Aarav Sharma"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleSubmit()}
          />
        </div>

        <div>
          <label className="label-muted mb-1.5 block">Resource needed</label>
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map((option) => (
              <button
                key={option}
                onClick={() => setType(option)}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm font-medium capitalize ring-1 transition-colors",
                  type === option
                    ? "bg-teal-600 text-white ring-teal-600"
                    : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="label-muted">Urgency score</label>
            <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700">
              {urgency}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={urgency}
            onChange={(event) => setUrgency(Number(event.target.value))}
            className="w-full accent-teal-600"
          />
          <div className="mt-1 flex justify-between text-xs text-slate-400">
            <span>1 · routine</span>
            <span>10 · critical</span>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="label-muted">Allocation mode</label>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                autoAllocate ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-500",
              )}
            >
              {autoAllocate ? "Automatic" : "Manual"}
            </span>
          </div>
          <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-500 ring-1 ring-slate-100">
            Set from the navigation bar. Automatic assigns bed patients to an available bed
            immediately; theatre and staff are always manual.
          </p>
        </div>

        {error && (
          <p className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertTriangle size={15} /> {error}
          </p>
        )}

        <button
          className="btn-primary w-full justify-center"
          disabled={createPatient.isPending || allocate.isPending}
          onClick={handleSubmit}
        >
          {createPatient.isPending || allocate.isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <UserPlus size={16} />
          )}
          {autoAllocate && type === "bed" ? "Add & auto-allocate bed" : "Add to waiting queue"}
        </button>
      </div>
    </Modal>
  );
}
