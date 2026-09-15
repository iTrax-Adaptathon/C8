import { AlertTriangle, Loader2, UserPlus } from "lucide-react";
import { useState } from "react";

import { useAllocate, useCreatePatient, useResources } from "../hooks/useHospitalData";
import { cn } from "../lib/utils";
import type { ResourceType, SeverityLevel } from "../types/hospital";
import { Modal } from "./Modal";

const TYPES: ResourceType[] = ["bed", "theatre", "staff"];
const SEVERITIES: SeverityLevel[] = ["Critical", "High", "Medium", "Low"];

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
  const [age, setAge] = useState("");
  const [type, setType] = useState<ResourceType>("bed");
  const [severity, setSeverity] = useState<SeverityLevel>("Medium");
  const [department, setDepartment] = useState("Ward");
  const [urgency, setUrgency] = useState(5);
  const [treatmentMinutes, setTreatmentMinutes] = useState(60);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setAge("");
    setType("bed");
    setSeverity("Medium");
    setDepartment("Ward");
    setUrgency(5);
    setTreatmentMinutes(60);
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
        age: age ? Number(age) : undefined,
        resource_type_needed: type,
        urgency_score: urgency,
        severity,
        department,
        estimated_treatment_minutes: treatmentMinutes,
      });
      if (autoAllocate && type === "bed") {
        const bed = resources.find(
          (resource) => resource.type === "bed" && resource.status === "available",
        );
        if (bed) {
          try {
            await allocate.mutateAsync({ resourceId: bed.id, patientId: patient.id });
          } catch {
            /* best effort */
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
      subtitle="Register a new hospital arrival into the clinical flow pipeline."
    >
      <div className="space-y-4">
        <div>
          <label className="label-muted mb-1.5 block">Patient name</label>
          <input
            autoFocus
            className="w-full rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Aarav Sharma"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleSubmit()}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-muted mb-1.5 block">Age</label>
            <input
              type="number"
              min={0}
              max={130}
              className="w-full rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500"
              placeholder="Optional"
              value={age}
              onChange={(event) => setAge(event.target.value)}
            />
          </div>
          <div>
            <label className="label-muted mb-1.5 block">Estimated treatment (min)</label>
            <input
              type="number"
              min={1}
              max={1440}
              className="w-full rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500"
              value={treatmentMinutes}
              onChange={(event) => setTreatmentMinutes(Number(event.target.value))}
            />
          </div>
        </div>

        <div>
          <label className="label-muted mb-1.5 block">Acuity &amp; Severity</label>
          <div className="grid grid-cols-4 gap-1.5">
            {SEVERITIES.map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => {
                  setSeverity(sev);
                  if (sev === "Critical") setUrgency(9);
                  else if (sev === "High") setUrgency(7);
                  else if (sev === "Medium") setUrgency(5);
                  else setUrgency(2);
                }}
                className={cn(
                  "rounded-lg py-1.5 text-xs font-semibold ring-1 transition-colors",
                  severity === sev
                    ? "bg-blue-600 text-white ring-blue-600"
                    : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
                )}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-muted mb-1.5 block">Resource needed</label>
            <select
              className="w-full rounded-xl border-0 bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200"
              value={type}
              onChange={(e) => setType(e.target.value as ResourceType)}
            >
              {TYPES.map((option) => (
                <option key={option} value={option}>
                  {option.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label-muted mb-1.5 block">Department</label>
            <select
              className="w-full rounded-xl border-0 bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="ICU">ICU</option>
              <option value="Emergency">Emergency</option>
              <option value="Ward">Ward</option>
              <option value="Surgical">Surgical</option>
            </select>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="label-muted">Urgency score</label>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
              {urgency}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={urgency}
            onChange={(event) => setUrgency(Number(event.target.value))}
            className="w-full accent-blue-600"
          />
          <div className="mt-1 flex justify-between text-xs text-slate-400">
            <span>1 · routine</span>
            <span>10 · critical</span>
          </div>
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
          {autoAllocate && type === "bed" ? "Add & auto-allocate bed" : "Add to clinical flow"}
        </button>
      </div>
    </Modal>
  );
}
