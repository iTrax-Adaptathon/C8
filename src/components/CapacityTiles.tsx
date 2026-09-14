import { BedDouble, Clock, Scissors, Users, type LucideIcon } from "lucide-react";

import { cn } from "../lib/utils";
import type { Patient, Resource } from "../types/hospital";

function barTone(availableRatio: number): string {
  if (availableRatio >= 0.55) return "bg-emerald-500";
  if (availableRatio >= 0.3) return "bg-amber-500";
  return "bg-red-500";
}

function Tile({
  icon: Icon,
  value,
  label,
  sub,
  ratio,
  tone,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  sub: string;
  ratio: number;
  tone: string;
}) {
  return (
    <div className="card group transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
      <div className="flex items-start justify-between">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-600">
          <Icon size={20} />
        </div>
        <span className="text-slate-300 transition-colors group-hover:text-teal-500">↗</span>
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-full rounded-full transition-all duration-700", tone)}
          style={{ width: `${Math.max(4, Math.min(100, ratio * 100))}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-400">{sub}</p>
    </div>
  );
}

const count = (resources: Resource[], type: string, status?: string) =>
  resources.filter((r) => r.type === type && (!status || r.status === status)).length;

export function CapacityTiles({
  resources,
  waiting,
}: {
  resources: Resource[];
  waiting: Patient[];
}) {
  const bedTotal = count(resources, "bed");
  const bedAvail = count(resources, "bed", "available");
  const theatreTotal = count(resources, "theatre");
  const theatreAvail = count(resources, "theatre", "available");
  const staffTotal = count(resources, "staff");
  const staffAvail = count(resources, "staff", "available");

  const bedRatio = bedTotal ? bedAvail / bedTotal : 0;
  const theatreRatio = theatreTotal ? theatreAvail / theatreTotal : 0;
  const staffRatio = staffTotal ? staffAvail / staffTotal : 0;
  const waitingLoad = Math.min(1, waiting.length / 12);

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tile
        icon={BedDouble}
        value={`${bedAvail} / ${bedTotal}`}
        label="Beds available"
        sub={`${bedTotal - bedAvail} committed`}
        ratio={bedRatio}
        tone={barTone(bedRatio)}
      />
      <Tile
        icon={Scissors}
        value={`${theatreAvail} / ${theatreTotal}`}
        label="Theatre slots available"
        sub={`${theatreTotal - theatreAvail} in use / blocked`}
        ratio={theatreRatio}
        tone={barTone(theatreRatio)}
      />
      <Tile
        icon={Users}
        value={`${Math.round(staffRatio * 100)}%`}
        label="Staff capacity available"
        sub={`${staffAvail} of ${staffTotal} units free`}
        ratio={staffRatio}
        tone={barTone(staffRatio)}
      />
      <Tile
        icon={Clock}
        value={`${waiting.length}`}
        label="Patients waiting"
        sub={waiting.length > 0 ? "Queue needs attention" : "Queue clear"}
        ratio={waitingLoad}
        tone={waiting.length >= 6 ? "bg-red-500" : waiting.length >= 3 ? "bg-amber-500" : "bg-emerald-500"}
      />
    </section>
  );
}
