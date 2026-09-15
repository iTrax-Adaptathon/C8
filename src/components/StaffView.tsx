import { useState } from "react";
import { CheckCircle2, Clock, RefreshCw, UserCheck, Users } from "lucide-react";

import { usePatients, useStaff, useUpdateStaff } from "../hooks/useHospitalData";
import { cn, patientCode } from "../lib/utils";
import type { StaffAvailability } from "../types/hospital";

export function StaffView({ onSelect }: { onSelect: (resourceId: number) => void }) {
  const { data: staffList = [], isLoading, isFetching, refetch } = useStaff();
  const { data: patients = [] } = usePatients();
  const { mutate: updateStaff } = useUpdateStaff();

  const [deptFilter, setDeptFilter] = useState<string>("All");

  const departments = ["All", "ICU", "Emergency", "Surgical", "Ward"];

  const filteredStaff = staffList.filter((s) => {
    if (deptFilter === "All") return true;
    return (s.department || "").toUpperCase().includes(deptFilter.toUpperCase());
  });

  const handleAvailabilityChange = (staffId: number, newAvail: StaffAvailability) => {
    updateStaff({ staffId, input: { availability: newAvail } });
  };

  const assignedPatient = (resourceId: number) =>
    patients.find((patient) => patient.current_resource_id === resourceId) ?? null;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-600">
            <Users size={15} /> Clinical Workforce &amp; Duty Roster
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Staff Capacity &amp; Qualifications
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Verify qualified clinician availability for incoming patients and resource matching.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
        >
          <RefreshCw size={13} className={isFetching ? "animate-spin text-blue-600" : ""} />
          Refresh
        </button>
      </div>

      {/* Department Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
        {departments.map((dept) => (
          <button
            key={dept}
            onClick={() => setDeptFilter(dept)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              deptFilter === dept
                ? "bg-slate-900 text-white font-semibold"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            )}
          >
            {dept} ({staffList.filter((s) => dept === "All" || (s.department || "").toUpperCase().includes(dept.toUpperCase())).length})
          </button>
        ))}
      </div>

      {/* Staff Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-40 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStaff.map((staff) => {
            const patient = assignedPatient(staff.id);

            return (
              <div
                key={staff.id}
                className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs transition-shadow hover:shadow-sm space-y-3.5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700 font-bold text-sm">
                      <UserCheck size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm leading-snug">
                        {staff.name}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">{staff.role}</p>
                    </div>
                  </div>

                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize",
                      staff.availability === "available" && "bg-emerald-100 text-emerald-800",
                      staff.availability === "busy" && "bg-amber-100 text-amber-800",
                      staff.availability === "on_break" && "bg-blue-100 text-blue-800",
                      staff.availability === "off_shift" && "bg-slate-100 text-slate-600",
                    )}
                  >
                    {staff.availability.replace("_", " ")}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs border-y border-slate-100 py-2.5">
                  <div>
                    <span className="text-slate-400 block font-medium">Department</span>
                    <span className="font-semibold text-slate-800 mt-0.5 block">
                      {staff.department} ({staff.specialty})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Shift &amp; Workload</span>
                    <span className="font-semibold text-slate-800 mt-0.5 block">
                      {staff.shift} • {staff.workload} active case(s)
                    </span>
                  </div>
                </div>

                {/* Assigned Patient Info */}
                <div className="text-xs">
                  <span className="text-slate-400 font-medium">Assigned Patient: </span>
                  {patient ? (
                    <span className="font-semibold text-blue-700">
                      {patient.name} ({patientCode(patient.id)})
                    </span>
                  ) : (
                    <span className="text-slate-500">None currently assigned</span>
                  )}
                </div>

                {/* Availability State Toggle Buttons */}
                <div className="pt-1 flex items-center gap-1 border-t border-slate-100">
                  <span className="text-[11px] text-slate-400 mr-1">Set:</span>
                  {(["available", "busy", "on_break", "off_shift"] as StaffAvailability[]).map((st) => (
                    <button
                      key={st}
                      onClick={() => handleAvailabilityChange(staff.id, st)}
                      className={cn(
                        "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                        staff.availability === st
                          ? "bg-slate-900 text-white font-bold"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                      )}
                    >
                      {st.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
