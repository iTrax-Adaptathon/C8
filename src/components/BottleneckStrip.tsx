import { ChevronRight, HeartPulse } from "lucide-react";

import { cn } from "../lib/utils";
import type { Patient, Resource } from "../types/hospital";

interface Stage {
  label: string;
  value: string;
  detail: string;
  dot: string;
}

function toneFor(availableRatio: number, invert = false) {
  const healthy = invert ? availableRatio : 1 - availableRatio;
  if (healthy >= 0.6) return { dot: "bg-emerald-500", text: "text-emerald-600", label: "Healthy" };
  if (healthy >= 0.3) return { dot: "bg-amber-500", text: "text-amber-600", label: "Tight" };
  return { dot: "bg-red-500", text: "text-red-600", label: "Critical" };
}

export function BottleneckStrip({
  resources,
  waiting,
}: {
  resources: Resource[];
  waiting: Patient[];
}) {
  const beds = resources.filter((r) => r.type === "bed");
  const theatres = resources.filter((r) => r.type === "theatre");
  const bedAvail = beds.filter((r) => r.status === "available").length;
  const bedRatio = beds.length ? bedAvail / beds.length : 0;
  const bedTone = toneFor(bedRatio);
  const wardOccupancy = beds.length ? (beds.length - bedAvail) / beds.length : 0;
  const wardTone = toneFor(wardOccupancy, true);
  const theatreAvail = theatres.filter((r) => r.status === "available").length;
  const theatreRatio = theatres.length ? theatreAvail / theatres.length : 0;
  const theatreTone = toneFor(theatreRatio);

  const waitingTone =
    waiting.length >= 6
      ? { dot: "bg-red-500", text: "text-red-600", label: "Blocked" }
      : waiting.length >= 3
        ? { dot: "bg-amber-500", text: "text-amber-600", label: "Busy" }
        : { dot: "bg-emerald-500", text: "text-emerald-600", label: "Clear" };

  const stages: Stage[] = [
    {
      label: "Waiting",
      value: `${waiting.length} patients`,
      detail: waitingTone.label,
      dot: waitingTone.dot,
    },
    {
      label: "Beds",
      value: `${bedAvail} available`,
      detail: bedTone.label,
      dot: bedTone.dot,
    },
    {
      label: "Ward",
      value: `${Math.round(wardOccupancy * 100)}% occupied`,
      detail: wardTone.label,
      dot: wardTone.dot,
    },
    {
      label: "Theatre",
      value: `${theatreAvail} available`,
      detail: theatreTone.label,
      dot: theatreTone.dot,
    },
  ];

  return (
    <section className="card">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-50 text-teal-600">
          <HeartPulse size={16} />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Patient flow</h2>
          <p className="text-xs text-slate-400">Emergency → Ward pipeline health</p>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {stages.map((stage, index) => (
          <div key={stage.label} className="flex flex-1 items-center gap-3">
            <div className="flex flex-1 items-center justify-between rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
              <div className="flex items-center gap-2.5">
                <span className={cn("h-2.5 w-2.5 rounded-full", stage.dot)} />
                <div>
                  <p className="text-sm font-semibold text-slate-700">{stage.label}</p>
                  <p className="text-xs text-slate-400">{stage.value}</p>
                </div>
              </div>
              <span className="text-xs font-medium text-slate-400">{stage.detail}</span>
            </div>
            {index < stages.length - 1 && (
              <ChevronRight size={16} className="hidden shrink-0 text-slate-300 sm:block" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
