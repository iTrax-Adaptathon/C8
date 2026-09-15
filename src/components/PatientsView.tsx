import { useState } from "react";
import {
  AlertCircle,
  Bed,
  Check,
  CheckCircle2,
  Clock,
  LogOut,
  Plus,
  ArrowRight,
  UserCheck,
  Users,
} from "lucide-react";

import {
  useAllocate,
  useDischarge,
  useMarkDischargePending,
  usePatients,
  useResources,
} from "../hooks/useHospitalData";
import { cn, formatDateTime, humanWait, minutesSince, patientCode, urgencyTone } from "../lib/utils";
import type { Patient, PatientStatus, SeverityLevel } from "../types/hospital";
import { StatusPill } from "./StatusPill";

type FilterKey = "all" | "en_route" | "waiting" | "reserved" | "admitted" | "discharge_pending" | "discharged";

const FLOW_STAGES: { key: FilterKey; label: string; match: (s: PatientStatus) => boolean }[] = [
  { key: "all", label: "All Patients", match: () => true },
  { key: "en_route", label: "En Route", match: (s) => s === "en_route" },
  { key: "waiting", label: "Waiting", match: (s) => s === "waiting" || s === "arrived" },
  { key: "reserved", label: "Reserved", match: (s) => s === "reserved" },
  { key: "admitted", label: "Admitted", match: (s) => s === "admitted" },
  { key: "discharge_pending", label: "Discharge Pending", match: (s) => s === "discharge_pending" },
  { key: "discharged", label: "Discharged", match: (s) => s === "discharged" },
];

export function PatientsView({
  onViewPatient,
  onAddPatient,
}: {
  onViewPatient: (id: number) => void;
  onAddPatient: () => void;
}) {
  const { data: patients = [], isLoading } = usePatients();
  const { data: resources = [] } = useResources();
  const [filter, setFilter] = useState<FilterKey>("all");

  const { mutate: markDischargePending, isPending: isPendingDP } = useMarkDischargePending();
  const { mutate: dischargePatient, isPending: isPendingDC } = useDischarge();
  const { mutate: allocatePatient, isPending: isPendingAlloc } = useAllocate();

  const activeFilter = FLOW_STAGES.find((item) => item.key === filter) ?? FLOW_STAGES[0];
  const visible = patients.filter((patient) => activeFilter.match(patient.status));

  const resourceName = (id: number | null) =>
    resources.find((resource) => resource.id === id)?.name ?? "—";

  return (
    <section className="space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600">
            <ArrowRight size={15} /> Patient Journey &amp; Clinical Flow
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Patient Flow Management
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Track patient progression through each stage from incoming transport to discharge.
          </p>
        </div>
        <button
          onClick={onAddPatient}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
        >
          <Plus size={14} /> Add Patient
        </button>
      </div>

      {/* Stage Filter Pills */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200/80 pb-3">
        {FLOW_STAGES.map((item) => {
          const count = patients.filter((p) => item.match(p.status)).length;
          return (
            <button
              key={item.key}
              onClick={() => setFilter(item.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5",
                filter === item.key
                  ? "bg-blue-600 text-white font-semibold"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
            >
              {item.label}
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.2 text-[11px] font-semibold",
                  filter === item.key ? "bg-white/20 text-white" : "bg-white text-slate-600",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs">
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="h-12 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-500">
            <Users size={24} className="text-slate-300" />
            <p>No patients currently in this stage.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="pb-3">Patient</th>
                  <th className="pb-3">Stage / Status</th>
                  <th className="pb-3">Severity &amp; Acuity</th>
                  <th className="pb-3">Requirement</th>
                  <th className="pb-3">Assigned Bed / Resource</th>
                  <th className="pb-3">Waiting Time</th>
                  <th className="pb-3 text-right">Care Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((patient) => {
                  const waitMinutes = patient.waiting_minutes ?? minutesSince(patient.waiting_since);
                  const isCriticalWait = patient.severity === "Critical" && waitMinutes >= 15;

                  return (
                    <tr
                      key={patient.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td
                        className="py-3 cursor-pointer"
                        onClick={() => onViewPatient(patient.id)}
                      >
                        <p className="font-semibold text-slate-900 hover:text-blue-600">
                          {patient.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {patientCode(patient.id)}
                          {patient.ambulance_id && ` • Amb ${patient.ambulance_id}`}
                        </p>
                      </td>
                      <td className="py-3">
                        <StatusPill status={patient.status} />
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "rounded-md px-2 py-0.5 text-xs font-semibold",
                              patient.severity === "Critical" && "bg-rose-100 text-rose-800",
                              patient.severity === "High" && "bg-amber-100 text-amber-800",
                              patient.severity === "Medium" && "bg-yellow-100 text-yellow-800",
                              patient.severity === "Low" && "bg-slate-100 text-slate-800",
                            )}
                          >
                            {patient.severity ?? "Medium"}
                          </span>
                          <span className="text-xs text-slate-400">Score {patient.urgency_score}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium uppercase text-slate-700">
                          {patient.resource_type_needed}
                        </span>
                        {patient.department && (
                          <span className="ml-1 text-xs text-slate-400">({patient.department})</span>
                        )}
                      </td>
                      <td className="py-3 font-medium text-slate-800">
                        {resourceName(patient.current_resource_id)}
                      </td>
                      <td className="py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-xs font-medium",
                            isCriticalWait ? "text-rose-600 font-bold" : "text-slate-600",
                          )}
                        >
                          <Clock size={12} />
                          {patient.status === "waiting" || patient.status === "en_route"
                            ? humanWait(waitMinutes)
                            : "Admitted"}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {/* If Reserved: Admit Button */}
                          {patient.status === "reserved" && patient.current_resource_id && (
                            <button
                              onClick={() =>
                                allocatePatient({
                                  resourceId: patient.current_resource_id!,
                                  patientId: patient.id,
                                })
                              }
                              disabled={isPendingAlloc}
                              className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
                            >
                              Admit
                            </button>
                          )}

                          {/* If Admitted: Discharge Pending */}
                          {patient.status === "admitted" && (
                            <button
                              onClick={() => markDischargePending({ patientId: patient.id })}
                              disabled={isPendingDP}
                              className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                            >
                              Discharge Pending
                            </button>
                          )}

                          {/* If Discharge Pending or Admitted: Discharge */}
                          {(patient.status === "discharge_pending" || patient.status === "admitted") && (
                            <button
                              onClick={() => dischargePatient({ patientId: patient.id })}
                              disabled={isPendingDC}
                              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                              title="Discharge patient and release occupied resource"
                            >
                              Discharge &amp; Free Bed
                            </button>
                          )}

                          <button
                            onClick={() => onViewPatient(patient.id)}
                            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                          >
                            History
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
