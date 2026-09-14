import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Backend stores naive UTC; make it comparable in the browser. */
export function parseUtc(value: string): Date {
  const iso = /[zZ]|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`;
  return new Date(iso);
}

export function minutesSince(value: string): number {
  const diff = Date.now() - parseUtc(value).getTime();
  return Math.max(0, Math.floor(diff / 60000));
}

export function humanWait(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export function formatTime(value: string): string {
  return parseUtc(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(value: string): string {
  return parseUtc(value).toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function patientCode(id: number): string {
  return `P${String(id).padStart(3, "0")}`;
}

/** Beds are typed by name prefix: "ICU B..." vs "Ward B...". */
export function isIcuBed(resource: { type: string; name: string }): boolean {
  return resource.type === "bed" && resource.name.trim().toLowerCase().startsWith("icu");
}

export function isWardBed(resource: { type: string; name: string }): boolean {
  return resource.type === "bed" && !isIcuBed(resource);
}

export function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function urgencyTone(score: number): string {
  if (score >= 5) return "text-red-600 bg-red-50 ring-red-100";
  if (score >= 4) return "text-amber-600 bg-amber-50 ring-amber-100";
  return "text-slate-600 bg-slate-100 ring-slate-200";
}

/** Utilisation -> traffic-light tone for the bottleneck strip. */
export function utilizationTone(ratio: number, invert = false): {
  dot: string;
  text: string;
  label: string;
} {
  const healthy = invert ? ratio : 1 - ratio;
  if (healthy >= 0.6) return { dot: "bg-emerald-500", text: "text-emerald-600", label: "Healthy" };
  if (healthy >= 0.3) return { dot: "bg-amber-500", text: "text-amber-600", label: "Tight" };
  return { dot: "bg-red-500", text: "text-red-600", label: "Critical" };
}
