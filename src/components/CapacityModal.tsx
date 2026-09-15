import { AlertTriangle, Building2, Loader2, Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { useCreateResources, useRemoveResource } from "../hooks/useHospitalData";
import type { Resource, NewResourceInput } from "../types/hospital";
import { Modal } from "./Modal";

export function CapacityModal({
  open,
  resources,
  onClose,
}: {
  open: boolean;
  resources: Resource[];
  onClose: () => void;
}) {
  const createResources = useCreateResources();
  const removeResource = useRemoveResource();
  const [type, setType] = useState<"bed" | "staff">("bed");
  const [name, setName] = useState("ICU Bed");
  const [quantity, setQuantity] = useState(1);
  const [department, setDepartment] = useState("ICU");
  const [role, setRole] = useState("ICU Nurse");
  const [error, setError] = useState<string | null>(null);

  const removable = useMemo(
    () => resources.filter((resource) => resource.type === type && resource.status === "available"),
    [resources, type],
  );
  const counts = {
    bed: resources.filter((resource) => resource.type === "bed").length,
    staff: resources.filter((resource) => resource.type === "staff").length,
  };

  function reset() {
    setError(null);
    setQuantity(1);
  }

  async function handleAdd() {
    setError(null);
    const input: NewResourceInput = {
      type,
      name: name.trim(),
      quantity,
      department,
      role: type === "staff" ? role : undefined,
      specialty: type === "staff" ? department : undefined,
      shift: type === "staff" ? "Day Shift" : undefined,
    };
    try {
      await createResources.mutateAsync(input);
      reset();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not add capacity.");
    }
  }

  async function handleRemove() {
    const resource = removable[removable.length - 1];
    if (!resource) return;
    setError(null);
    try {
      await removeResource.mutateAsync(resource.id);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Could not remove capacity.");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Manage Hospital Capacity" subtitle="Adjust bed and clinical staff counts without affecting active assignments.">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {(["bed", "staff"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setType(item);
                setName(item === "bed" ? "ICU Bed" : "ICU Nurse");
                setDepartment(item === "bed" ? "ICU" : "Critical Care");
              }}
              className={`rounded-xl border px-3 py-3 text-left text-sm ${type === item ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-600"}`}
            >
              <span className="block text-xs font-semibold uppercase tracking-wide">{item === "bed" ? "Beds" : "Clinical staff"}</span>
              <span className="mt-1 block text-2xl font-bold">{counts[item]}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[1fr_110px] gap-3">
          <div>
            <label className="label-muted mb-1.5 block">Unit name</label>
            <input className="w-full rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div>
            <label className="label-muted mb-1.5 block">Add count</label>
            <input type="number" min={1} max={50} className="w-full rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
          </div>
        </div>

        <div>
          <label className="label-muted mb-1.5 block">Department</label>
          <input className="w-full rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200" value={department} onChange={(event) => setDepartment(event.target.value)} />
        </div>

        {type === "staff" && (
          <div>
            <label className="label-muted mb-1.5 block">Role</label>
            <input className="w-full rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200" value={role} onChange={(event) => setRole(event.target.value)} />
          </div>
        )}

        {error && <p className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700"><AlertTriangle size={15} />{error}</p>}

        <div className="flex gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={handleAdd} disabled={createResources.isPending || !name.trim()} className="btn-primary flex-1 justify-center">
            {createResources.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Add capacity
          </button>
          <button type="button" onClick={handleRemove} disabled={removeResource.isPending || removable.length === 0} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50" title="Remove the last available unit">
            {removeResource.isPending ? <Loader2 size={16} className="animate-spin" /> : <Minus size={16} />}
            Remove one
          </button>
        </div>
        <p className="flex items-center gap-2 text-xs text-slate-500"><Building2 size={14} />Only available units can be removed; reserved and committed capacity stays protected.</p>
      </div>
    </Modal>
  );
}