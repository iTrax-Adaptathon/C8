import { useState } from "react";
import { Siren, X } from "lucide-react";

import { useCreateAmbulance } from "../hooks/useHospitalData";
import type { SeverityLevel } from "../types/hospital";

export function AddAmbulanceModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [code, setCode] = useState("");
  const [eta, setEta] = useState(10);
  const [severity, setSeverity] = useState<SeverityLevel>("High");
  const [requiredResource, setRequiredResource] = useState("ICU Bed");
  const [patientName, setPatientName] = useState("");

  const { mutate: createAmbulance, isPending } = useCreateAmbulance();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    createAmbulance(
      {
        ambulance_code: code.trim().toUpperCase(),
        eta_minutes: Number(eta),
        severity,
        required_resource: requiredResource,
        patient_name: patientName.trim() || undefined,
      },
      {
        onSuccess: () => {
          setCode("");
          setPatientName("");
          onClose();
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-100">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-amber-700">
            <Siren size={18} />
            <h2 className="text-base font-bold text-slate-900">Intake Incoming Ambulance</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Ambulance Code / Call Sign:
            </label>
            <input
              type="text"
              required
              placeholder="e.g. A412"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ETA (Minutes):
              </label>
              <input
                type="number"
                min={1}
                max={240}
                required
                value={eta}
                onChange={(e) => setEta(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Severity:
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as SeverityLevel)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Required Resource:
            </label>
            <select
              value={requiredResource}
              onChange={(e) => setRequiredResource(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="ICU Bed">ICU Bed</option>
              <option value="Emergency Bed">Emergency Bed</option>
              <option value="Ward Bed">Ward Bed</option>
              <option value="Theatre">Theatre</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Patient Name (Optional):
            </label>
            <input
              type="text"
              placeholder="e.g. John Doe"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
            >
              Register &amp; Check Capacity
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
