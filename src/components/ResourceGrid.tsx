import { LayoutGrid } from "lucide-react";
import { useState } from "react";

import { cn } from "../lib/utils";
import type { Resource, ResourceType } from "../types/hospital";
import { StatusPill } from "./StatusPill";

const TABS: { key: "all" | ResourceType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "bed", label: "Beds" },
  { key: "theatre", label: "Theatre" },
  { key: "staff", label: "Staff" },
];

const GROUP_ORDER: ResourceType[] = ["bed", "theatre", "staff"];
const GROUP_LABEL: Record<ResourceType, string> = {
  bed: "Beds",
  theatre: "Theatre",
  staff: "Staff capacity",
};

export function ResourceGrid({
  resources,
  onSelect,
}: {
  resources: Resource[];
  onSelect: (resource: Resource) => void;
}) {
  const [filter, setFilter] = useState<"all" | ResourceType>("all");

  const visible = resources.filter((resource) => filter === "all" || resource.type === filter);
  const groups = GROUP_ORDER.filter((type) => visible.some((resource) => resource.type === type));

  return (
    <section className="card">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-50 text-teal-600">
          <LayoutGrid size={16} />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Resource Grid</h2>
          <p className="text-xs text-slate-400">Click a resource to allocate or release</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              filter === tab.key
                ? "bg-teal-600 text-white"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="max-h-[620px] space-y-5 overflow-y-auto pr-1">
        {groups.map((type) => {
          const items = visible.filter((resource) => resource.type === type);
          const available = items.filter((resource) => resource.status === "available").length;
          return (
            <div key={type}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {GROUP_LABEL[type]}
                </p>
                <p className="text-xs text-slate-400">
                  {available}/{items.length} available
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {items.map((resource) => (
                  <button
                    key={resource.id}
                    onClick={() => onSelect(resource)}
                    className={cn(
                      "group flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2.5 text-left ring-1 transition-all hover:-translate-y-0.5 hover:shadow-card-hover",
                      resource.status === "available"
                        ? "ring-slate-100"
                        : "ring-slate-100 opacity-80",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={cn(
                          "h-2.5 w-2.5 shrink-0 rounded-full",
                          resource.status === "available" ? "bg-emerald-500" : "bg-slate-400",
                        )}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {resource.name}
                        </p>
                      </div>
                    </div>
                    <StatusPill status={resource.status} />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
