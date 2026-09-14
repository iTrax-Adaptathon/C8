import { ScrollText } from "lucide-react";

import { useRecentEvents } from "../hooks/useHospitalData";
import { formatTime, patientCode, titleCase } from "../lib/utils";

export function AuditFeed() {
  const { data: events = [] } = useRecentEvents();

  return (
    <section className="card">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-600">
          <ScrollText size={16} />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Audit Trail</h2>
          <p className="text-xs text-slate-400">Insert-only · newest first</p>
        </div>
      </div>

      {events.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          No events yet.
        </p>
      ) : (
        <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex items-start gap-3 rounded-xl bg-slate-50/70 px-3 py-2.5 ring-1 ring-slate-100"
            >
              <span className="mt-0.5 shrink-0 rounded-md bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-teal-600 ring-1 ring-slate-100">
                {event.event_type.replace(/_/g, " ")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-600">
                  {event.note ?? titleCase(event.event_type)}
                </p>
                <p className="text-xs text-slate-400">
                  {event.patient_id ? `${patientCode(event.patient_id)} · ` : ""}
                  {formatTime(event.created_at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
