import { cn } from "../lib/utils";

const TONES: Record<string, string> = {
  available: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  committed: "bg-slate-100 text-slate-600 ring-slate-200",
  allocated: "bg-sky-50 text-sky-700 ring-sky-200",
  waiting: "bg-amber-50 text-amber-700 ring-amber-200",
  admitted: "bg-blue-50 text-blue-700 ring-blue-200",
  discharged: "bg-slate-100 text-slate-500 ring-slate-200",
};

const DOTS: Record<string, string> = {
  available: "bg-emerald-500",
  committed: "bg-slate-400",
  allocated: "bg-sky-500",
  waiting: "bg-amber-500",
  admitted: "bg-blue-500",
  discharged: "bg-slate-400",
};

export function StatusPill({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1",
        TONES[status] ?? "bg-slate-100 text-slate-600 ring-slate-200",
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", DOTS[status] ?? "bg-slate-400")} />
      {status}
    </span>
  );
}
