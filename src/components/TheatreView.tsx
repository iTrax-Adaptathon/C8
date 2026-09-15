import { useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Scissors,
  Users,
} from "lucide-react";

import {
  useCreateTheatreBooking,
  useTheatreBookings,
  useTheatres,
} from "../hooks/useHospitalData";
import { cn, formatDateTime } from "../lib/utils";
import type { TheatreBooking } from "../types/hospital";

export function TheatreView() {
  const { data: theatres = [], isFetching, refetch } = useTheatres();
  const { data: bookings = [], refetch: refetchBookings } = useTheatreBookings();
  const { mutate: createBooking, isPending } = useCreateTheatreBooking();

  const [showModal, setShowModal] = useState(false);
  const [theatreId, setTheatreId] = useState<number | null>(null);
  const [surgeryName, setSurgeryName] = useState("");
  const [specialty, setSpecialty] = useState("General Surgery");
  const [staffRequired, setStaffRequired] = useState("Dr. Marcus Vance");
  const [duration, setDuration] = useState(90);
  const [startTime, setStartTime] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 30);
    return d.toISOString().slice(0, 16);
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!theatreId) return;

    createBooking(
      {
        theatre_id: theatreId,
        surgery_name: surgeryName,
        required_specialty: specialty,
        required_staff: staffRequired,
        start_time: new Date(startTime).toISOString(),
        duration_minutes: Number(duration),
      },
      {
        onSuccess: () => {
          setShowModal(false);
          setSurgeryName("");
          refetchBookings();
        },
        onError: (err: any) => {
          setErrorMessage(err.message || "Overlap conflict with existing booking.");
        },
      }
    );
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-600">
            <Scissors size={15} /> Surgical Suites &amp; Operating Rooms
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Operating Theatre Management
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Timetable, surgery duration, qualified surgical staff, and booking conflict prevention.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              refetch();
              refetchBookings();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={13} className={isFetching ? "animate-spin text-blue-600" : ""} />
            Refresh
          </button>
          <button
            onClick={() => {
              setTheatreId(theatres[0]?.id ?? null);
              setShowModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} /> Schedule Surgery
          </button>
        </div>
      </div>

      {/* Theatres Status Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {theatres.map((th) => {
          const isOccupied = th.status === "committed";
          const activeBookings = bookings.filter((b) => b.theatre_id === th.id);

          return (
            <div
              key={th.id}
              className={cn(
                "rounded-xl border p-4 shadow-xs transition-shadow hover:shadow-sm bg-white",
                isOccupied ? "border-amber-200" : "border-slate-200/90"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">{th.name}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                    isOccupied ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                  )}
                >
                  {th.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {th.specialty ?? "General Surgery"}
              </p>

              <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Scheduled:</span>
                  <span className="font-semibold text-slate-800">{activeBookings.length} procedure(s)</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bookings Timetable */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 mb-4">Surgical Schedule &amp; Bookings</h2>

        {bookings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
            No surgical procedures currently scheduled.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="pb-3">Procedure</th>
                  <th className="pb-3">Theatre Suite</th>
                  <th className="pb-3">Specialty</th>
                  <th className="pb-3">Start &amp; End Time</th>
                  <th className="pb-3">Duration</th>
                  <th className="pb-3">Lead Clinician</th>
                  <th className="pb-3 text-right">Booking Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 font-semibold text-slate-900">
                      {booking.surgery_name}
                      {booking.patient_name && (
                        <p className="text-xs font-normal text-slate-400">Patient: {booking.patient_name}</p>
                      )}
                    </td>
                    <td className="py-3 font-medium text-slate-800">
                      {booking.theatre_name ?? `Theatre #${booking.theatre_id}`}
                    </td>
                    <td className="py-3">
                      <span className="rounded-md bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                        {booking.required_specialty}
                      </span>
                    </td>
                    <td className="py-3 text-slate-700 text-xs">
                      {new Date(booking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{" "}
                      {new Date(booking.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3">
                      <span className="inline-flex items-center gap-1 text-xs text-slate-600 font-medium">
                        <Clock size={13} /> {booking.duration_minutes} min
                      </span>
                    </td>
                    <td className="py-3 text-xs text-slate-700 font-medium">
                      {booking.required_staff ?? "Surgical Team"}
                    </td>
                    <td className="py-3 text-right">
                      <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
                        {booking.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Schedule Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Schedule Surgical Procedure</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            {errorMessage && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
                <AlertTriangle size={15} />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Procedure Name:
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Exploratory Laparoscopy"
                  value={surgeryName}
                  onChange={(e) => setSurgeryName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Theatre Suite:
                  </label>
                  <select
                    className="w-full rounded-lg border border-slate-200 p-2 text-sm"
                    value={theatreId ?? ""}
                    onChange={(e) => setTheatreId(Number(e.target.value))}
                  >
                    {theatres.map((th) => (
                      <option key={th.id} value={th.id}>
                        {th.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Specialty:
                  </label>
                  <select
                    className="w-full rounded-lg border border-slate-200 p-2 text-sm"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                  >
                    <option value="General Surgery">General Surgery</option>
                    <option value="Orthopaedics">Orthopaedics</option>
                    <option value="Cardiothoracic">Cardiothoracic</option>
                    <option value="Neurosurgery">Neurosurgery</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Start Time:
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Duration (Minutes):
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={480}
                    step={15}
                    required
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 p-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lead Staff / Surgeon:
                </label>
                <input
                  type="text"
                  value={staffRequired}
                  onChange={(e) => setStaffRequired(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
                <strong>Conflict Prevention:</strong> MedFlow checks the schedule across the selected theatre to reject any overlapping bookings.
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
                >
                  Validate &amp; Confirm Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
