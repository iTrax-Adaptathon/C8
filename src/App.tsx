import { AlertCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AddAmbulanceModal } from "./components/AddAmbulanceModal";
import { AddPatientModal } from "./components/AddPatientModal";
import { CapacityModal } from "./components/CapacityModal";
import { AmbulanceView } from "./components/AmbulanceView";
import { AuditFeed } from "./components/AuditFeed";
import { HomeView } from "./components/HomeView";
import { PatientsView } from "./components/PatientsView";
import { PatientHistoryModal } from "./components/PatientHistoryModal";
import { ResourceModal } from "./components/ResourceModal";
import { StaffView } from "./components/StaffView";
import { TheatreView } from "./components/TheatreView";
import { TopNav, type PageKey } from "./components/TopNav";
import {
  POLL_INTERVAL_MS,
  useAutoAllocateQueue,
  usePatients,
  useResources,
  useWaiting,
} from "./hooks/useHospitalData";
import { useTheme } from "./hooks/useTheme";
import type { Resource } from "./types/hospital";

export default function App() {
  const { data: resources = [], isError } = useResources();
  const { data: waiting = [] } = useWaiting();
  const { data: patients = [] } = usePatients();
  const { mutate: autoAllocateQueue } = useAutoAllocateQueue();
  const { theme, toggleTheme } = useTheme();

  const [page, setPage] = useState<PageKey>("home");
  const [autoAllocate, setAutoAllocate] = useState(false);
  const [historyPatientId, setHistoryPatientId] = useState<number | null>(null);
  const [selectedResourceId, setSelectedResourceId] = useState<number | null>(null);
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [showAddAmbulance, setShowAddAmbulance] = useState(false);
  const [showCapacity, setShowCapacity] = useState(false);

  useEffect(() => {
    if (!autoAllocate) return;
    autoAllocateQueue();
    const timer = window.setInterval(autoAllocateQueue, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [autoAllocate, autoAllocateQueue]);

  const selectedResource = useMemo<Resource | null>(
    () => resources.find((resource) => resource.id === selectedResourceId) ?? null,
    [resources, selectedResourceId],
  );
  const historyPatient = useMemo(
    () => patients.find((patient) => patient.id === historyPatientId) ?? null,
    [patients, historyPatientId],
  );

  return (
    <div className="min-h-screen bg-canvas">
      <TopNav
        active={page}
        onNavigate={setPage}
        autoAllocate={autoAllocate}
        onAutoAllocateChange={setAutoAllocate}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="mx-auto max-w-[1440px] px-5 py-6 sm:px-6">
        {isError && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={18} />
            <div>
              <p className="font-semibold">Cannot reach the backend API.</p>
              <p className="text-red-600">
                Start FastAPI on http://127.0.0.1:8000 (see README) — the dashboard will reconnect
                on the next poll.
              </p>
            </div>
          </div>
        )}

        {page === "home" && (
          <HomeView
            onNavigateTab={(tab) => setPage(tab as PageKey)}
            onViewPatient={setHistoryPatientId}
            onAddPatient={() => setShowAddPatient(true)}
            onAddAmbulance={() => setShowAddAmbulance(true)}
            onManageCapacity={() => setShowCapacity(true)}
          />
        )}
        {page === "ambulances" && (
          <AmbulanceView onAddAmbulance={() => setShowAddAmbulance(true)} />
        )}
        {page === "patients" && (
          <PatientsView
            onViewPatient={setHistoryPatientId}
            onAddPatient={() => setShowAddPatient(true)}
          />
        )}
        {page === "theatres" && <TheatreView />}
        {page === "staff" && <StaffView onSelect={setSelectedResourceId} />}
        {page === "audit" && <AuditFeed />}
      </main>

      <ResourceModal
        resource={selectedResource}
        resources={resources}
        waiting={waiting}
        patients={patients}
        onClose={() => setSelectedResourceId(null)}
        onViewPatient={setHistoryPatientId}
      />

      <PatientHistoryModal
        patientId={historyPatientId}
        patient={historyPatient}
        onClose={() => setHistoryPatientId(null)}
      />

      <AddPatientModal
        open={showAddPatient}
        autoAllocate={autoAllocate}
        onClose={() => setShowAddPatient(false)}
        onCreated={(patientId) => setHistoryPatientId(patientId)}
      />

      <AddAmbulanceModal
        isOpen={showAddAmbulance}
        onClose={() => setShowAddAmbulance(false)}
      />

      <CapacityModal
        open={showCapacity}
        resources={resources}
        onClose={() => setShowCapacity(false)}
      />
    </div>
  );
}
