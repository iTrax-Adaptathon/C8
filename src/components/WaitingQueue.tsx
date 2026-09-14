import { Clock, Plus } from "lucide-react";

import { useWaiting } from "../hooks/useHospitalData";
import { cn, humanWait, minutesSince, patientCode, urgencyTone } from "../lib/utils";
import { StatusPill } from "./StatusPill";

export function WaitingQueue({
  onViewPatient,
  onAddPatient,
}: {
  onViewPatient: (id: number) => void;
  onAddPatient: () => void;
}) {
  const { data: waiting = [], isLoading } = useWaiting();

  return (
    <section className="card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-50 text-amber-600">
            <Clock size={16} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Waiting Queue</h2>
            <p className="text-xs text-slate-400">Sorted by urgency, then waiting time</p>
          </div>
          <span className="ml-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
            {waiting.length}
          </span>
        </div>
        <button className="btn-primary !py-1.5" onClick={onAddPatient}>
          <Plus size={15} /> Add Patient
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-12 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : waiting.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500">
          The waiting queue is empty.
        </div>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-y-1 px-2">
            <thead>
              <tr className="text-left">
                <th className="label-muted px-2 pb-1">Patient</th>
                <th className="label-muted px-2 pb-1">Needs</th>
                <th className="label-muted px-2 pb-1">Urgency</th>
                <th className="label-muted px-2 pb-1">Waiting</th>
                <th className="label-muted px-2 pb-1 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {waiting.map((patient) => {
                const waited = minutesSince(patient.waiting_since);
                return (
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
                    <td className="px-2 py-2.5 text-sm text-slate-600">{humanWait(waited)}</td>
                    <td className="rounded-r-xl px-2 py-2.5 text-right">
                      <StatusPill status={patient.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
