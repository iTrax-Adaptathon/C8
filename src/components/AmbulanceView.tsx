import { useState } from "react";
import {
  AlertCircle,
  Bed,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Siren,
  XCircle,
} from "lucide-react";

import {
  useAmbulances,
  useArriveAmbulance,
  useCancelAmbulance,
  useReserveAmbulance,
  useResources,
} from "../hooks/useHospitalData";
import { cn } from "../lib/utils";
import type { Ambulance, Resource } from "../types/hospital";

export function AmbulanceView({
  onAddAmbulance,
}: {
  onAddAmbulance: () => void;
}) {
  const [filter, setFilter] = useState<string>("En Route");
  const { data: ambulances = [], isLoading, isFetching, refetch } = useAmbulances();
  const { data: resources = [] } = useResources();

  const { mutate: arriveAmbulance, isPending: isArrivePending } = useArriveAmbulance();
  const { mutate: cancelAmbulance, isPending: isCancelPending } = useCancelAmbulance();
  const { mutate: reserveAmbulance, isPending: isReservePending } = useReserveAmbulance();

  const [selectedAmbForReserve, setSelectedAmbForReserve] = useState<Ambulance | null>(null);
  const [selectedResourceId, setSelectedResourceId] = useState<number | null>(null);

  const filteredAmbulances = ambulances.filter((amb) => {
    if (filter === "All") return true;
    return amb.status === filter;
  });

  const availableBeds = resources.filter(
    (r) => r.type === "bed" && r.status === "available"
  );

  const handleReserve = () => {
    if (!selectedAmbForReserve || !selectedResourceId) return;
    reserveAmbulance(
      { ambulanceId: selectedAmbForReserve.id, resourceId: selectedResourceId },
      {
        onSuccess: () => {
          setSelectedAmbForReserve(null);
          setSelectedResourceId(null);
        },
      }
    );
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-600">
            <Siren size={15} /> Incoming Fleet Management
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Ambulance &amp; Emergency Transport
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Track ETA, verify bed availability prior to arrival, and pre-reserve hospital resources.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={13} className={isFetching ? "animate-spin text-blue-600" : ""} />
            Refresh
          </button>
          <button
            onClick={onAddAmbulance}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} /> Intake Ambulance
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
        {["En Route", "Arrived", "Cancelled", "All"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f
                ? "bg-slate-900 text-white font-semibold"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            )}
          >
            {f} ({ambulances.filter((a) => f === "All" || a.status === f).length})
          </button>
        ))}
      </div>

      {/* Ambulance Cards Grid */}
      {filteredAmbulances.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
          No ambulances found under status "{filter}".
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAmbulances.map((amb) => {
            const reservedResource = amb.reserved_resource_id
              ? resources.find((r) => r.id === amb.reserved_resource_id)
              : null;

            return (
              <div
                key={amb.id}
                className={cn(
                  "rounded-xl border bg-white p-5 shadow-xs transition-shadow hover:shadow-sm space-y-4",
                  amb.severity === "Critical" ? "border-rose-200" : "border-slate-200/90",
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "grid h-8 w-8 place-items-center rounded-lg font-bold text-xs",
                        amb.severity === "Critical"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-amber-100 text-amber-700",
                      )}
                    >
                      <Siren size={16} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Ambulance {amb.ambulance_code}
                      </h3>
                      <p className="text-xs text-slate-400">ID #{amb.id}</p>
                    </div>
                  </div>

                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-xs font-semibold",
                      amb.severity === "Critical" && "bg-rose-100 text-rose-800",
                      amb.severity === "High" && "bg-amber-100 text-amber-800",
                      amb.severity === "Medium" && "bg-yellow-100 text-yellow-800",
                      amb.severity === "Low" && "bg-slate-100 text-slate-800",
                    )}
                  >
                    {amb.severity}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs border-y border-slate-100 py-2.5">
                  <div>
                    <span className="text-slate-400 block font-medium">ETA</span>
                    <span className="font-semibold text-slate-900 text-sm inline-flex items-center gap-1 mt-0.5">
                      <Clock size={13} className="text-amber-600" />
                      {amb.status === "En Route" ? `${amb.eta_minutes} mins` : "0 mins"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Required Resource</span>
                    <span className="font-semibold text-slate-900 mt-0.5 block">
                      {amb.required_resource}
                    </span>
                  </div>
                </div>

                {/* Pre-Reservation Status */}
                <div>
                  {reservedResource ? (
                    <div className="flex items-center justify-between rounded-lg bg-purple-50 p-2.5 text-xs text-purple-900 border border-purple-200">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 size={15} className="text-purple-600" />
                        <span>Pre-Reserved: <strong>{reservedResource.name}</strong></span>
                      </div>
                    </div>
                  ) : amb.status === "En Route" ? (
                    <div className="rounded-lg bg-amber-50/70 p-2.5 text-xs text-amber-800 border border-amber-200 flex items-center justify-between">
                      <span>No bed pre-reserved yet.</span>
                      <button
                        onClick={() => setSelectedAmbForReserve(amb)}
                        className="font-semibold text-blue-700 underline hover:text-blue-900"
                      >
                        Reserve Now
                      </button>
                    </div>
                  ) : null}
                </div>

                {/* Actions */}
                {amb.status === "En Route" && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => arriveAmbulance(amb.id)}
                      disabled={isArrivePending}
                      className="flex-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
                    >
                      Mark Arrived
                    </button>
                    <button
                      onClick={() => cancelAmbulance(amb.id)}
                      disabled={isCancelPending}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reserve Modal */}
      {selectedAmbForReserve && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Pre-Reserve Resource for Ambulance {selectedAmbForReserve.ambulance_code}
              </h3>
              <button
                onClick={() => setSelectedAmbForReserve(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <p className="text-xs text-slate-500">
                Required Resource: <strong>{selectedAmbForReserve.required_resource}</strong> (ETA:{" "}
                {selectedAmbForReserve.eta_minutes} min, Severity:{" "}
                {selectedAmbForReserve.severity})
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Compatible Available Bed:
                </label>
                <select
                  className="w-full rounded-lg border border-slate-200 p-2 text-sm"
                  value={selectedResourceId ?? ""}
                  onChange={(e) => setSelectedResourceId(Number(e.target.value) || null)}
                >
                  <option value="">-- Choose available bed --</option>
                  {availableBeds.map((bed) => (
                    <option key={bed.id} value={bed.id}>
                      {bed.name} ({bed.department ?? "Ward"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
                <strong>Concurrency Protection:</strong> Reserving locks this bed immediately at the database level so no other patient can be double-booked into it.
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setSelectedAmbForReserve(null)}
                className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReserve}
                disabled={!selectedResourceId || isReservePending}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
              >
                Confirm Reservation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
