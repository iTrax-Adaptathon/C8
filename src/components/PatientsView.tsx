import { Plus, Users } from "lucide-react";
import { useState } from "react";

import { usePatients, useResources } from "../hooks/useHospitalData";
import { cn, formatDateTime, humanWait, minutesSince, patientCode, urgencyTone } from "../lib/utils";
import type { PatientStatus } from "../types/hospital";
import { StatusPill } from "./StatusPill";

type FilterKey = "all" | "admitted" | "waiting" | "discharge";

const FILTERS: { key: FilterKey; label: string; match: (status: PatientStatus) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "admitted", label: "Admitted", match: (status) => status === "admitted" },
  { key: "waiting", label: "Waiting", match: (status) => status === "waiting" },
  { key: "discharge", label: "Discharge", match: (status) => status === "discharged" },
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

  const activeFilter = FILTERS.find((item) => item.key === filter) ?? FILTERS[0];
  const visible = patients.filter((patient) => activeFilter.match(patient.status));

  const resourceName = (id: number | null) =>
    resources.find((resource) => resource.id === id)?.name ?? "—";

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-muted mb-1">Patient registry</p>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Patients
            </h1>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {patients.length} total
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Every patient ever registered, including discharged and removed from the queue.
          </p>
        </div>
        <button className="btn-primary" onClick={onAddPatient}>
          <Plus size={16} /> Add Patient
        </button>
      </div>

      <div className="card">
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {FILTERS.map((item) => {
            const count = patients.filter((patient) => item.match(patient.status)).length;
            return (
              <button
                key={item.key}
                onClick={() => setFilter(item.key)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                  filter === item.key
                    ? "bg-teal-600 text-white"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200",
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "ml-1.5 rounded-full px-1.5 text-[11px] font-semibold",
                    filter === item.key ? "bg-white/20 text-white" : "bg-white text-slate-500",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="h-12 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center">
            <Users size={20} className="text-slate-300" />
            <p className="text-sm text-slate-500">No patients match this filter.</p>
          </div>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[720px] border-separate border-spacing-y-1 px-2">
              <thead>
                <tr className="text-left">
                  <th className="label-muted px-2 pb-1">Patient</th>
                  <th className="label-muted px-2 pb-1">Needs</th>
                  <th className="label-muted px-2 pb-1">Urgency</th>
                  <th className="label-muted px-2 pb-1">Assigned resource</th>
                  <th className="label-muted px-2 pb-1">Waiting</th>
                  <th className="label-muted px-2 pb-1 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((patient) => (
                  <tr
                    key={patient.id}
                    onClick={() => onViewPatient(patient.id)}
                    className="cursor-pointer bg-slate-50/70 transition-colors hover:bg-teal-50/70"
                  >
                    <td className="rounded-l-xl px-2 py-2.5">
                      <p className="text-sm font-semibold text-slate-800">{patient.name}</p>
                      <p className="text-xs text-slate-400">{patientCode(patient.id)}</p>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium capitalize text-slate-600">
                        {patient.resource_type_needed}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1",
                          urgencyTone(patient.urgency_score),
                        )}
                      >
                        {patient.urgency_score}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-sm text-slate-600">
                      {resourceName(patient.current_resource_id)}
                    </td>
                    <td className="px-2 py-2.5 text-sm text-slate-600">
                      {patient.status === "waiting"
                        ? humanWait(minutesSince(patient.waiting_since))
                        : formatDateTime(patient.waiting_since)}
                    </td>
                    <td className="rounded-r-xl px-2 py-2.5 text-right">
                      <StatusPill status={patient.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
