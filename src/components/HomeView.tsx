import {
  AlertTriangle,
  Bed,
  CheckCircle2,
  Clock,
  ExternalLink,
  Plus,
  RefreshCw,
  Siren,
  ArrowRight,
  UserCheck,
  Users,
} from "lucide-react";

import { useDashboardSummary } from "../hooks/useHospitalData";
import { cn } from "../lib/utils";
import type { Ambulance, BottleneckAlert, Patient } from "../types/hospital";

export function HomeView({
  onNavigateTab,
  onViewPatient,
  onAddPatient,
  onAddAmbulance,
}: {
  onNavigateTab: (tab: string) => void;
  onViewPatient: (id: number) => void;
  onAddPatient: () => void;
  onAddAmbulance: () => void;
}) {
  const { data: summary, isLoading, isFetching, refetch } = useDashboardSummary();

  const bedsAvailable = summary?.beds_available ?? 0;
  const bedsTotal = summary?.beds_total ?? 20;
  const staffAvailable = summary?.staff_available ?? 0;
  const staffTotal = summary?.staff_total ?? 10;
  const ambulancesEnRoute = summary?.ambulances_en_route ?? 0;
  const bottlenecksCount = summary?.critical_bottlenecks ?? 0;

  const patientFlow = summary?.patient_flow ?? {
    en_route: 0,
    waiting: 0,
    reserved: 0,
    admitted: 0,
    discharge_pending: 0,
  };

  const ambulances = summary?.incoming_ambulances ?? [];
  const alerts = summary?.alerts ?? [];
  const recentPatients = summary?.recent_patients ?? [];

  return (
    <div className="space-y-6 pb-12">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Hospital Operations
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Capacity &amp; Patient Flow Control
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Real-time bed availability, incoming ambulances, and flow bottlenecks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900 transition-colors"
            title="Refresh dashboard data"
          >
            <RefreshCw size={13} className={isFetching ? "animate-spin text-blue-600" : ""} />
            Refresh
          </button>
          <button
            onClick={onAddAmbulance}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
          >
            <Siren size={14} /> Intake Ambulance
          </button>
          <button
            onClick={onAddPatient}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} /> Add Patient
          </button>
        </div>
      </div>

      {/* 1. TOP 4 SUMMARY CARDS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Beds */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Hospital Beds
            </span>
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-600">
              <Bed size={17} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900">
              {bedsAvailable}
            </span>
            <span className="text-sm font-medium text-slate-500">/ {bedsTotal} Available</span>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${(bedsAvailable / Math.max(bedsTotal, 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* Staff */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Clinical Staff
            </span>
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
              <Users size={17} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900">
              {staffAvailable}
            </span>
            <span className="text-sm font-medium text-slate-500">/ {staffTotal} Available</span>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {staffTotal - staffAvailable} currently committed or on break
          </p>
        </div>

        {/* Incoming Ambulances */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Incoming Ambulances
            </span>
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-50 text-amber-600">
              <Siren size={17} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-amber-600">
              {ambulancesEnRoute}
            </span>
            <span className="text-sm font-medium text-slate-500">En Route</span>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {ambulances.filter((a) => a.severity === "Critical").length} critical arrival pending
          </p>
        </div>

        {/* Bottlenecks */}
        <div
          className={cn(
            "rounded-xl border p-5 shadow-xs transition-shadow hover:shadow-sm",
            bottlenecksCount > 0
              ? "border-rose-200 bg-rose-50/40"
              : "border-slate-200/90 bg-white",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Current Bottlenecks
            </span>
            <div
              className={cn(
                "grid h-8 w-8 place-items-center rounded-lg",
                bottlenecksCount > 0
                  ? "bg-rose-100 text-rose-600"
                  : "bg-emerald-50 text-emerald-600",
              )}
            >
              <AlertTriangle size={17} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={cn(
                "text-3xl font-extrabold tracking-tight",
                bottlenecksCount > 0 ? "text-rose-600" : "text-emerald-700",
              )}
            >
              {bottlenecksCount}
            </span>
            <span className="text-sm font-medium text-slate-500">Active alerts</span>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {bottlenecksCount > 0 ? "Action needed on current flow" : "Operations nominal"}
          </p>
        </div>
      </div>

      {/* 2. PATIENT FLOW SECTION: En Route → Waiting → Reserved → Admitted → Discharge Pending */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRight size={16} className="text-blue-600" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Patient Flow Pipeline
            </h2>
          </div>
          <button
            onClick={() => onNavigateTab("patients")}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
          >
            Manage Patients <ExternalLink size={12} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
          {/* En Route */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-center">
            <div className="text-xs font-medium text-amber-800">En Route</div>
            <div className="mt-1 text-2xl font-bold text-amber-900">{patientFlow.en_route}</div>
          </div>

          {/* Waiting */}
          <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3 text-center">
            <div className="text-xs font-medium text-sky-800">Waiting</div>
            <div className="mt-1 text-2xl font-bold text-sky-900">{patientFlow.waiting}</div>
          </div>

          {/* Reserved */}
          <div className="rounded-lg border border-purple-200 bg-purple-50/60 p-3 text-center">
            <div className="text-xs font-medium text-purple-800">Reserved</div>
            <div className="mt-1 text-2xl font-bold text-purple-900">{patientFlow.reserved}</div>
          </div>

          {/* Admitted */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-center">
            <div className="text-xs font-medium text-emerald-800">Admitted</div>
            <div className="mt-1 text-2xl font-bold text-emerald-900">{patientFlow.admitted}</div>
          </div>

          {/* Discharge Pending */}
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-3 text-center col-span-2 sm:col-span-1">
            <div className="text-xs font-medium text-indigo-800">Discharge Pending</div>
            <div className="mt-1 text-2xl font-bold text-indigo-900">
              {patientFlow.discharge_pending}
            </div>
          </div>
        </div>
      </div>

      {/* 3. TWO COLUMNS: LEFT (Incoming Ambulances) | RIGHT (Current Alerts + Recent Patients) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT: Incoming Ambulances */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Siren size={18} className="text-amber-600" />
              <h2 className="text-base font-bold text-slate-900">Incoming Ambulances</h2>
            </div>
            <button
              onClick={() => onNavigateTab("ambulances")}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
            >
              Full Ambulance View <ExternalLink size={12} />
            </button>
          </div>

          {ambulances.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
              No ambulances currently en route.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="pb-2.5">Ambulance ID</th>
                    <th className="pb-2.5">ETA</th>
                    <th className="pb-2.5">Severity</th>
                    <th className="pb-2.5">Required Resource</th>
                    <th className="pb-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ambulances.map((amb) => (
                    <tr
                      key={amb.id}
                      onClick={() => onNavigateTab("ambulances")}
                      className="cursor-pointer hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3 font-semibold text-slate-900">
                        {amb.ambulance_code}
                      </td>
                      <td className="py-3">
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                          <Clock size={13} /> {amb.eta_minutes} min
                        </span>
                      </td>
                      <td className="py-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold",
                            amb.severity === "Critical" && "bg-rose-100 text-rose-800",
                            amb.severity === "High" && "bg-amber-100 text-amber-800",
                            amb.severity === "Medium" && "bg-yellow-100 text-yellow-800",
                            amb.severity === "Low" && "bg-slate-100 text-slate-800",
                          )}
                        >
                          {amb.severity}
                        </span>
                      </td>
                      <td className="py-3 font-medium text-slate-700">
                        {amb.required_resource}
                      </td>
                      <td className="py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-ping" />
                          {amb.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">Protocol:</span> When an ambulance is approaching, resources are checked against ETA to ensure bed readiness before patient arrival.
          </div>
        </div>

        {/* RIGHT: Current Alerts + Recent Patients */}
        <div className="space-y-6 lg:col-span-5">
          {/* Current Alerts */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-rose-600" />
                <h2 className="text-base font-bold text-slate-900">Current Alerts</h2>
              </div>
              <span className="text-xs text-slate-500 font-medium">Needs Attention</span>
            </div>

            {alerts.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3.5 text-sm text-emerald-800">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <div>
                  <p className="font-semibold">All systems nominal</p>
                  <p className="text-xs text-emerald-700">No critical bottlenecks or capacity blocks detected.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {alerts.slice(0, 4).map((alert) => (
                  <div
                    key={alert.id}
                    className={cn(
                      "rounded-lg border p-3 text-sm transition-colors",
                      alert.severity === "Critical"
                        ? "border-rose-200 bg-rose-50/70 text-rose-900"
                        : "border-amber-200 bg-amber-50/70 text-amber-900",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-xs uppercase tracking-wide">
                        {alert.title}
                      </p>
                      <span
                        className={cn(
                          "rounded-sm px-1.5 py-0.2 text-[10px] font-bold uppercase",
                          alert.severity === "Critical"
                            ? "bg-rose-200 text-rose-800"
                            : "bg-amber-200 text-amber-800",
                        )}
                      >
                        {alert.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-700">
                      {alert.detail}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Patients */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Recent Patients
              </h3>
              <button
                onClick={() => onNavigateTab("patients")}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                View all
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {recentPatients.slice(0, 4).map((patient) => (
                <div
                  key={patient.id}
                  onClick={() => onViewPatient(patient.id)}
                  className="flex items-center justify-between py-2 cursor-pointer hover:bg-slate-50/80 transition-colors rounded-sm px-1"
                >
                  <div>
                    <span className="font-medium text-slate-900 text-sm">{patient.name}</span>
                    <span className="ml-2 text-xs text-slate-400">
                      {patient.resource_type_needed.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[11px] font-medium capitalize",
                        patient.status === "waiting" && "bg-sky-50 text-sky-700",
                        patient.status === "reserved" && "bg-purple-50 text-purple-700",
                        patient.status === "admitted" && "bg-emerald-50 text-emerald-700",
                        patient.status === "discharge_pending" && "bg-indigo-50 text-indigo-700",
                      )}
                    >
                      {patient.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
