import { Plus, RefreshCw } from "lucide-react";

import { useResources, useWaiting } from "../hooks/useHospitalData";
import { AuditFeed } from "./AuditFeed";
import { BottleneckStrip } from "./BottleneckStrip";
import { CapacityTiles } from "./CapacityTiles";
import { MatchPanel } from "./MatchPanel";
import { RaceSimulator } from "./RaceSimulator";
import { ResourceGrid } from "./ResourceGrid";
import { WaitingQueue } from "./WaitingQueue";

export function HomeView({
  onViewPatient,
  onAddPatient,
  onSelectResource,
}: {
  onViewPatient: (id: number) => void;
  onAddPatient: () => void;
  onSelectResource: (id: number) => void;
}) {
  const { data: resources = [], isFetching, refetch } = useResources();
  const { data: waiting = [] } = useWaiting();

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-muted mb-1">Capacity · Live operations</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Operations &amp; Capacity
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Beds, theatre and staff capacity refreshing every 2.5 seconds.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={() => refetch()} title="Force refresh now">
            <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} /> Refresh
          </button>
          <button className="btn-primary" onClick={onAddPatient}>
            <Plus size={16} /> Add Patient
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <CapacityTiles resources={resources} waiting={waiting} />
        <BottleneckStrip resources={resources} waiting={waiting} />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-7">
            <MatchPanel onViewPatient={onViewPatient} />
            <WaitingQueue onViewPatient={onViewPatient} onAddPatient={onAddPatient} />
          </div>
          <div className="space-y-6 xl:col-span-5">
            <ResourceGrid resources={resources} onSelect={(resource) => onSelectResource(resource.id)} />
            <RaceSimulator />
          </div>
        </div>

        <AuditFeed />
      </div>
    </>
  );
}
