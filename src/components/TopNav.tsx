import { LogOut, Moon, Sun } from "lucide-react";

import { cn } from "../lib/utils";
import type { Theme } from "../hooks/useTheme";
import logo from "../logo.png";

export type PageKey = "home" | "ambulances" | "patients" | "theatres" | "staff" | "audit";

const NAV_ITEMS: { key: PageKey; label: string }[] = [
  { key: "home", label: "Dashboard" },
  { key: "ambulances", label: "Ambulances" },
  { key: "patients", label: "Patient Flow" },
  { key: "theatres", label: "Theatres" },
  { key: "staff", label: "Staff" },
  { key: "audit", label: "Audit Trail" },
];

export function TopNav({
  active,
  onNavigate,
  autoAllocate,
  onAutoAllocateChange,
  theme,
  onToggleTheme,
  userName,
  onSignOut,
}: {
  active: PageKey;
  onNavigate: (page: PageKey) => void;
  autoAllocate: boolean;
  onAutoAllocateChange: (value: boolean) => void;
  theme: Theme;
  onToggleTheme: () => void;
  userName: string;
  onSignOut: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur shadow-xs">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-6">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => onNavigate("home")}>
          <img src={logo} alt="Helio" className="h-9 w-9 rounded-xl object-cover" />
          <div>
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-none">Helio</span>
            <span className="hidden sm:inline-block ml-2 text-xs font-medium text-slate-400">Control Center</span>
          </div>
        </div>

        <nav className="ml-6 flex items-center gap-1 overflow-x-auto py-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all whitespace-nowrap",
                active === item.key
                  ? "bg-blue-50 text-blue-700 font-semibold ring-1 ring-blue-200"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div
            className="flex items-center rounded-lg bg-slate-100 p-0.5 border border-slate-200"
            title="Resource allocation mode"
          >
            <button
              onClick={() => onAutoAllocateChange(false)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                !autoAllocate
                  ? "bg-white text-slate-800 shadow-xs font-semibold"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              Manual
            </button>
            <button
              onClick={() => onAutoAllocateChange(true)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                autoAllocate
                  ? "bg-white text-blue-700 shadow-xs font-semibold"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              Auto-Pilot
            </button>
          </div>

          <button
            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button className="icon-btn" onClick={onSignOut} title={`Sign out ${userName}`} aria-label="Sign out">
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </header>
  );
}
