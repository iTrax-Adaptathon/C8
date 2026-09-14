import { UserCheck, Users } from "lucide-react";
import { useState } from "react";

import { usePatients, useResources } from "../hooks/useHospitalData";
import { cn, patientCode } from "../lib/utils";
import { StatusPill } from "./StatusPill";

type FilterKey = "all" | "allocated" | "available";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "allocated", label: "Allocated" },
  { key: "available", label: "Not allocated" },
];

export function StaffView({ onSelect }: { onSelect: (resourceId: number) => void }) {
  const { data: resources = [], isLoading } = useResources();
  const { data: patients = [] } = usePatients();
  const [filter, setFilter] = useState<FilterKey>("all");

  const staff = resources.filter((resource) => resource.type === "staff");
  const allocatedCount = staff.filter((resource) => resource.status === "committed").length;

  const visible = staff.filter((resource) => {
    if (filter === "allocated") return resource.status === "committed";
    if (filter === "available") return resource.status === "available";
    return true;
  });

  const assignedPatient = (resourceId: number) =>
    patients.find((patient) => patient.current_resource_id === resourceId) ?? null;

  return (
    <section className="space-y-5">
      <div>
        <p className="label-muted mb-1">Workforce</p>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Staff</h1>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {allocatedCount}/{staff.length} allocated
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Every staff member, showing whether they are currently allocated to a patient.
        </p>
      </div>

      <div className="card">
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {FILTERS.map((item) => {
            const count =
              item.key === "all"
                ? staff.length
                : item.key === "allocated"
                  ? allocatedCount
                  : staff.length - allocatedCount;
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
            <p className="text-sm text-slate-500">No staff members match this filter.</p>
          </div>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[640px] border-separate border-spacing-y-1 px-2">
              <thead>
                <tr className="text-left">
                  <th className="label-muted px-2 pb-1">Staff member</th>
                  <th className="label-muted px-2 pb-1">Assigned patient</th>
                  <th className="label-muted px-2 pb-1 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((resource) => {
                  const patient = assignedPatient(resource.id);
                  return (
                    <tr
                      key={resource.id}
                      onClick={() => onSelect(resource.id)}
                      className="cursor-pointer bg-slate-50/70 transition-colors hover:bg-teal-50/70"
                    >
                      <td className="rounded-l-xl px-2 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-50 text-teal-600">
                            <UserCheck size={15} />
                          </span>
                          <p className="text-sm font-semibold text-slate-800">{resource.name}</p>
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-sm text-slate-600">
                        {patient ? (
                          <span>
                            {patient.name}{" "}
                            <span className="text-slate-400">{patientCode(patient.id)}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">Unallocated</span>
                        )}
                      </td>
                      <td className="rounded-r-xl px-2 py-2.5 text-right">
                        <StatusPill
                          status={resource.status === "committed" ? "allocated" : "available"}
                        />
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
