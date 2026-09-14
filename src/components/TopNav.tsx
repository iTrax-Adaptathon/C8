import { Activity, Moon, Sun } from "lucide-react";

import { cn } from "../lib/utils";
import type { Theme } from "../hooks/useTheme";

export type PageKey = "home" | "patients" | "staff";

const NAV_ITEMS: { key: PageKey; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "patients", label: "Patients" },
  { key: "staff", label: "Staff" },
];

export function TopNav({
  active,
  onNavigate,
  autoAllocate,
  onAutoAllocateChange,
  theme,
  onToggleTheme,
}: {
  active: PageKey;
  onNavigate: (page: PageKey) => void;
  autoAllocate: boolean;
  onAutoAllocateChange: (value: boolean) => void;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-6">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-teal-600 text-white shadow-sm">
            <Activity size={18} />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900">MedFlow</span>
        </div>

        <nav className="ml-6 flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                active === item.key
                  ? "bg-teal-50 text-teal-700 ring-1 ring-teal-100"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <div
            className="flex items-center rounded-full bg-slate-100 p-1"
            title="Patient allocation mode"
          >
            <button
              onClick={() => onAutoAllocateChange(false)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                !autoAllocate
                  ? "bg-white text-slate-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              Manual
            </button>
            <button
              onClick={() => onAutoAllocateChange(true)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                autoAllocate
                  ? "bg-white text-teal-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              Automatic
            </button>
          </div>

          <button
            className="icon-btn"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>
    </header>
  );
}
