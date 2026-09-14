import {
  ArrowRightLeft,
  BedDouble,
  Clock,
  LogOut,
  Lock,
  Sparkles,
  Unlock,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import { useHistory } from "../hooks/useHospitalData";
import { formatDateTime, patientCode } from "../lib/utils";
import type { Patient } from "../types/hospital";
import { Modal } from "./Modal";

const EVENT_META: Record<string, { icon: LucideIcon; tone: string; label: string }> = {
  patient_created: { icon: UserPlus, tone: "bg-slate-100 text-slate-600", label: "Patient created" },
  patient_waiting: { icon: Clock, tone: "bg-amber-100 text-amber-600", label: "Moved to waiting" },
  match_recommended: { icon: Sparkles, tone: "bg-teal-100 text-teal-600", label: "Match recommended" },
  resource_committed: { icon: Lock, tone: "bg-blue-100 text-blue-600", label: "Resource committed" },
  patient_admitted: { icon: BedDouble, tone: "bg-emerald-100 text-emerald-600", label: "Patient admitted" },
  patient_transferred: { icon: ArrowRightLeft, tone: "bg-indigo-100 text-indigo-600", label: "Patient transferred" },
  resource_released: { icon: Unlock, tone: "bg-violet-100 text-violet-600", label: "Resource released" },
  patient_discharged: { icon: LogOut, tone: "bg-slate-200 text-slate-600", label: "Patient discharged" },
};

export function PatientHistoryModal({
  patientId,
  patient,
  onClose,
}: {
  patientId: number | null;
  patient?: Patient | null;
  onClose: () => void;
}) {
  const { data: events = [], isLoading } = useHistory(patientId);

  return (
    <Modal
      open={patientId !== null}
      onClose={onClose}
      title={patient ? patient.name : patientId ? patientCode(patientId) : "Patient"}
      subtitle={
        patient
          ? `${patientCode(patient.id)} · ${patient.status} · needs a ${patient.resource_type_needed}`
          : "Full ordered audit trail - append-only, never edited"
      }
      width="max-w-xl"
    >
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-14 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          No events recorded for this patient yet.
        </p>
      ) : (
        <ol className="relative space-y-1">
          {events.map((event, index) => {
            const meta =
              EVENT_META[event.event_type] ?? {
                icon: Clock,
                tone: "bg-slate-100 text-slate-600",
                label: event.event_type,
              };
            const Icon = meta.icon;
            const isLast = index === events.length - 1;
            return (
              <li key={event.id} className="relative flex gap-3 pb-3">
                {!isLast && (
                  <span className="absolute left-[15px] top-9 h-[calc(100%-1.5rem)] w-px bg-slate-200" />
                )}
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${meta.tone}`}>
                  <Icon size={15} />
                </span>
                <div className="min-w-0 flex-1 rounded-xl bg-slate-50 px-3.5 py-2.5 ring-1 ring-slate-100">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-800">{meta.label}</p>
                    <time className="shrink-0 text-xs text-slate-400">
                      {formatDateTime(event.created_at)}
                    </time>
                  </div>
                  {event.note && <p className="mt-0.5 text-xs text-slate-500">{event.note}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Modal>
  );
}
