# Hospital Capacity & Patient Flow Platform — PRD (Windows Desktop Edition)

**Event:** Hackathon / Adaptathon Sprint 1
**Team size:** 4
**Build window:** ~4h45m
**Status:** Final — ready to build
**Platform change:** Web (React + FastAPI) → **Native Windows desktop app** (WPF client + ASP.NET Core local backend)

> **Assumption stated up front:** "Windows app" is interpreted here as a native Windows desktop client used by ward/ops staff on hospital workstations, talking to a small local/LAN backend service — not a browser wrapped in Electron, and not a cloud-hosted web app. Everything below is built around that assumption; flag it early if the team meant something else (e.g., a Windows-hosted web app viewed in Edge, which would need far fewer changes).

---

## 1. Problem Statement

Hospitals lose time and safety margin because capacity information is fragmented: a bed frees up but nobody sees it, a patient waits while a resource sits idle elsewhere, and double-booking a bed or theatre slot is a live safety risk. There is also no reliable, append-only record of what happened to a patient and when.

The platform must make hospital capacity visible, identify appropriate resources for waiting patients, allocate resources safely, and preserve a complete application-level audit trail of patient/resource state changes — from a Windows desktop client staff already have on ward workstations.

---

## 2. Goals

Build a platform that:

1. Surfaces available beds, theatre slots, and staff capacity as they change, in a native Windows client.
2. Matches waiting patients to the right primary resource as soon as it becomes available.
3. Keeps every change to a patient's status and history fully traceable through an append-only audit trail.
4. Guarantees that a resource cannot be successfully committed to more than one patient, even from two workstations at once.

### Definition of "Real-Time" for Sprint 1

Near-real-time updates using client-side polling every 2–3 seconds (a `DispatcherTimer` on the WPF client calling the local API). True push-based sync (SignalR, WebSockets) is explicitly out of scope unless the core MVP is already complete and stable.

---

## 3. Non-Goals / Explicitly Out of Scope

To protect the 4h45m build window, the following are **not** built in Sprint 1:

- Authentication / user roles / Windows login integration (Active Directory, etc.)
- Push notifications, including Windows Toast notifications
- Predictive analytics or ML-based forecasting
- Hardware or sensor integration of any kind (bed sensors, RFID, etc.) — all data entry is software-only, via manual staff input or mocked data
- Multi-hospital / multi-tenant support
- Advanced scheduling or calendar UI
- Multi-resource atomic scheduling (e.g., theatre + surgeon + anaesthetist as one coordinated transaction)
- Clinical decision-making or medical diagnosis
- An installer/MSIX package (demo runs from `dotnet publish` output — see §11)
- Service discovery across the LAN — the API's host/port is hardcoded for the demo (see §10)

These may be captured as "Next Team Ideas" for future sprints, but they must not delay the Sprint 1 MVP.

---

## 4. Users

### Primary User — Bedside / Ward / Operations Staff

Using the Windows desktop client on a ward workstation, they need to:

- View current hospital capacity
- See waiting patients
- Mark resources available or committed
- Confirm or release allocations
- Discharge patients
- Review patient/resource history

### Judges (Demo Persona)

For demo purposes, judges must be able to see, without lengthy narration:

1. Live capacity visibility
2. A patient-resource match
3. A double-booking attempt being blocked — demonstrated by running **two instances of the desktop client** (or two workstations) against the same backend
4. A complete patient history

No separate authentication system is required for Sprint 1.

---

## 5. MVP Scope — Core Features

### 5.1 Capacity Dashboard

A WPF window (or `UserControl`) displaying current counts and resource status for:

- Beds
- Theatre slots
- Staff capacity units
- Waiting patients

Dashboard data refreshes automatically every 2–3 seconds via a `DispatcherTimer`-driven poll of the local API.

### 5.2 Waiting Patient Queue

Displayed in a `DataGrid` or `ItemsControl` showing:

- Patient ID
- Name
- Required primary resource type
- Urgency score / priority
- Waiting time
- Current status

Ordered by:

1. Urgency score descending
2. Waiting time ascending (longest waiting first)

### 5.3 Resource Management

Resources can be marked available or committed.

Supported Sprint 1 resource types:

- `bed`
- `theatre`
- `staff`

#### Staff Semantics

Staff is modeled as an operational capacity unit, not an individual clinician assignment system. Staff capacity can be surfaced and marked available/committed, but staff-to-patient scheduling is out of scope.

### 5.4 Patient-Resource Matching

When a compatible resource becomes available, the system identifies the highest-priority waiting patient requiring that resource type.

Matching criteria:

1. Resource compatibility
2. Highest urgency score
3. Longest waiting time

The client displays a human-readable reason for the recommended match, sourced from the backend.

### 5.5 Safe Resource Allocation

A resource must never be successfully committed to more than one patient.

The protection must be enforced **server-side, in the backend process, at the database update level** — never only by disabling a WPF button. Two client instances hitting the same endpoint simultaneously is the exact scenario this must survive.

### 5.6 Patient Status + Audit Trail

Every meaningful state transition must create an append-only event.

Events must never be edited or deleted through the application (no direct grid-editing in the client, no raw SQL exposed to end users).

The history view must show ordered events with timestamps and enough information to understand what happened.

---

## 6. State Model

*(Unchanged — state modeling is platform-independent.)*

### Patient States

```text
waiting → admitted → discharged
```

### Resource States

```text
available → committed → available
```

### State Consistency Rule

Patient state changes, resource state changes, and their corresponding audit event must be written within the same database transaction wherever they represent one logical allocation/state transition.

### Sprint 1 Simplification

No separate `reserved` state or TTL hold. A successful match moves the resource directly from `available` to `committed`. Each patient request requires one primary resource type only.

---

## 7. Data Model

Use exactly **3 tables** for Sprint 1 (schema is DB-engine-independent; SQLite is still the right call for a single-file, zero-install Windows demo).

### `resources`

```text
id
resource_type       -- bed | theatre | staff
status              -- available | committed
version             -- incremented on successful state change
updated_at
```

### `patients`

```text
id
name
status              -- waiting | admitted | discharged
resource_type_needed -- bed | theatre | staff
urgency_score
waiting_since
```

### `events`

```text
id
patient_id
resource_id         -- nullable
event_type
note
created_at
```

The `events` table is append-only from the application perspective.

There is deliberately no `allocations` table. `resources.status` represents current commitment state; `events` preserves history.

### Windows-Specific: Database File Location

- SQLite file lives at `%LOCALAPPDATA%\HospitalFlow\hospitalflow.db` when the backend runs as a normal user process, or in the app's working directory for the hackathon demo — pick one and document it in the README, don't leave it ambiguous.
- **Enable WAL (Write-Ahead Logging) mode** (`PRAGMA journal_mode=WAL;`) on startup. Default SQLite rollback-journal mode serializes writers and will make the concurrent-commit race in §16 harder to demo cleanly; WAL allows concurrent readers alongside a writer and reduces lock contention when two client requests land close together.

---

## 8. API Contract

Same contract as the web version — the backend is still a REST API, just hosted with ASP.NET Core (Kestrel) instead of FastAPI/uvicorn.

| Endpoint | Purpose |
|---|---|
| `GET /resources` | List all resources with current status |
| `GET /patients/waiting` | Return waiting queue sorted by urgency then wait time |
| `POST /patients` | Add a patient to the waiting queue |
| `PATCH /resources/{id}/status` | Mark a resource available/committed where valid; triggers matching as appropriate |
| `POST /patients/{id}/discharge` | Discharge a patient, free their committed resource, record events, and trigger matching |
| `POST /resources/{id}/release` | Release/correct a current commitment safely; must preserve history and identify the affected patient |
| `GET /patients/{id}/history` | Return the patient's full ordered event history |
| `GET /matching` | Return current recommended matches / explanations |

### API Documentation

ASP.NET Core Minimal APIs ship Swagger/OpenAPI via `Swashbuckle.AspNetCore` (or the built-in `Microsoft.AspNetCore.OpenApi` in .NET 8/9). Expose it at:

```text
http://localhost:5080/swagger
```

This serves as the live API contract and interactive backend playground — same role FastAPI's `/docs` played, no separate exhaustive API reference needed in the README.

---

## 9. Core Allocation Logic

*(Logic is unchanged; SQL dialect and client library are adapted for .NET.)*

### Atomic Resource Commitment

```sql
UPDATE resources
SET status = 'committed',
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE id = @id
  AND status = 'available';
```

Executed via a parameterized `Microsoft.Data.Sqlite` command (or Dapper over the same connection) inside a `SqliteTransaction`. If `ExecuteNonQuery()` returns **0 rows affected**, another request already took the resource. The API must reject the allocation safely (HTTP 409 Conflict is the natural status code here).

This conditional update remains the primary double-booking protection — not application-level locks, not UI state.

### Transaction Requirement

For a successful allocation, within one `SqliteTransaction`:

1. Commit the resource.
2. Update the patient's status.
3. Insert the corresponding audit event.

Commit the transaction only after all three succeed; roll back on any failure. A failed allocation must not create a misleading successful state/event.

### Matching Logic

```sql
SELECT id
FROM patients
WHERE status = 'waiting'
  AND resource_type_needed = @resourceType
ORDER BY urgency_score DESC,
         waiting_since ASC
LIMIT 1;
```

Attempt the resource commitment atomically. If it fails because the resource has already been taken, retry with the next eligible candidate or return no match.

### Matching Trigger Points

`CheckForMatch(resourceType)` is triggered when:

- A resource becomes available
- A patient is discharged and frees a resource
- A new patient enters the waiting queue

---

## 10. Architecture

```text
      WPF Desktop Clients (1..N workstations)
         DispatcherTimer polling every 2–3s
                      │  HttpClient (JSON over HTTP)
                      ▼
        ASP.NET Core Minimal API (Kestrel)
          hosted as a console app / background
          process on the demo machine or LAN host
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
    Patients      Resources      Matching
        │             │             │
        └─────────────┼─────────────┘
                      ▼
          SQLite Database (WAL mode)
                 /      |      \
          patients  resources  events
```

### Architecture Constraints

- **Client:** WPF (.NET 8), MVVM pattern via `CommunityToolkit.Mvvm`. WPF is preferred over WinUI 3 for this build window — better tooling maturity, simpler deployment (no packaging project required to just run it), and the team likely has more WPF muscle memory under time pressure. Note this as a deliberate trade-off, not an oversight; WinUI 3 is a reasonable "next sprint" upgrade for a more modern Fluent look.
- **Backend:** ASP.NET Core Minimal API (C#), single project, self-hosted via Kestrel. Runs as a plain console app (`dotnet run`) for the demo — no IIS, no Windows Service wrapper, no reverse proxy.
- **Database:** SQLite, WAL journal mode, accessed via `Microsoft.Data.Sqlite` with raw parameterized SQL (per §9) — an ORM (EF Core) is optional and not required to hit the deadline.
- **Networking for the demo:** hardcode the API base URL (`http://localhost:5080` or the host machine's LAN IP) in client config. No service discovery, no mDNS.
- Single backend service, still no microservices, no message broker, no Redis/Kafka, no SignalR/WebSockets in Sprint 1.
- Prefer simple, modular code the next relay team can understand quickly — this applies equally to XAML/code-behind/ViewModel organization as it did to React components.

### Solution Structure

```text
HospitalFlow.sln
├── HospitalFlow.Api/          # ASP.NET Core Minimal API, Kestrel host
│   ├── Program.cs
│   ├── Endpoints/
│   ├── Data/                  # SQLite access, seed.py-equivalent
│   └── appsettings.json
├── HospitalFlow.Core/         # Shared models/DTOs used by API and client
└── HospitalFlow.Client/       # WPF app
    ├── App.xaml
    ├── Views/
    ├── ViewModels/
    └── Services/               # HttpClient wrapper, polling timer
```

A shared `Core` project keeps patient/resource/event DTOs consistent between backend and client without hand-copying JSON shapes — cheap insurance against drift, and it's a five-minute addition during the skeleton phase.

---

## 11. Build Strategy

### Skeleton First, Then Vertical Slices

One person builds a thin, fully wired end-to-end skeleton before the team splits, so nobody is blocked on basic plumbing.

### Skeleton — ~30–40 minutes

Must be complete before the team splits:

- All 3 tables created; WAL mode enabled on startup
- Seed routine (console flag or endpoint, e.g. `dotnet run --project HospitalFlow.Api -- --seed`) populates consistent demo data and is safe to rerun
- `HospitalFlow.Api` starts successfully (`dotnet run`), Swagger reachable at `/swagger`
- Core endpoints exist and return real DB data
- `HospitalFlow.Client` opens, one window fetches and renders real data from the API
- WPF → ASP.NET Core → SQLite is proven end-to-end
- Basic project structure established per §10
- Empty/placeholder ViewModel and endpoint files exist per feature to minimize merge conflicts
- `main` is tagged at the known-good foundation state

### Seed Data

Target demo data (unchanged):

- ~20 beds
- ~5 theatre slots
- ~10 staff capacity units
- ~10–15 patients in varied states

Must be safe to rerun during development/testing and reset to the same known state every time.

### Vertical Slices

Each person owns one feature end-to-end (API endpoint + WPF view/ViewModel), not a frontend/backend split.

| Person | Owns |
|---|---|
| A — Integration + Resources | Resource grid (WPF `DataGrid`), resource endpoints, allocation/release logic, Git integration |
| B — Patient Queue | Waiting queue view, add-patient flow (form/dialog), related API + ViewModel |
| C — Matching | Matching logic, atomic commitment, retry handling, "why this match" explanation panel |
| D — Audit + QA | Event helper, history endpoint, history view, seed/testing support |

The client can use hardcoded/mocked DTOs (from `HospitalFlow.Core`) when the API endpoint isn't ready yet, so WPF work doesn't stall on backend timing — same principle as the original "mocked JSON" approach, just typed C# objects instead of raw JSON.

### Merge Cadence

Merge small, tested changes to `main` approximately every 20 minutes rather than one large merge near the end.

---

## 12. Timeline

*(Unchanged from the original sprint plan — swapping tech stack doesn't change the clock.)*

| Time | Phase |
|---|---|
| 7:00–7:30 | Planning: MVP, schema, API contract, state transitions, solution structure, branches |
| 7:30–8:10 | Skeleton build + seed data |
| 8:10–9:30 | Vertical-slice development; merge approximately every 20 min |
| 9:30–9:45 | Integration checkpoint; test complete end-to-end flow |
| 9:45–10:15 | Dinner / buffer |
| 10:15–11:00 | WOW features — choose at most two |
| 11:00 | **CODE FREEZE** |
| 11:00–11:25 | QA pass and bug fixes only |
| 11:25–11:45 | Handoff package, README, TODO, `appsettings.example.json`, final Git push |

---

## 13. WOW Features — Pick At Most Two

### Priority 1 — Explainable Matching

**Recommended.** Matching already computes urgency and waiting time, so surfacing the reason in a WPF panel is low-cost/high-impact.

```text
Recommended Match

Patient P001 → ICU Bed B102

Why?
✓ Compatible resource type
✓ Highest urgency
✓ Longest waiting time
✓ Resource currently available
```

### Priority 2 — Patient Flow / Bottleneck View

A simple flow visual (could be a horizontal `ItemsControl` of stages with count badges):

```text
Emergency → Waiting → Beds → Ward → Theatre → Recovery
```

### Priority 3 — Live Simulation Controls

Optional, only if the MVP is already stable — a small "demo control panel" window/pane with buttons:

- Free bed
- Discharge patient
- Release staff capacity
- Release theatre slot

These should update the dashboard and trigger matching where appropriate. (This is a manual-trigger panel, not a push notification — stays inside the non-goals boundary in §3.)

---

## 14. Acceptance Criteria

The Sprint 1 MVP is considered complete only when all of the following are true.

### Capacity Visibility

- Given seeded resources, the dashboard displays current counts by resource type and status.
- Dashboard data refreshes approximately every 2–3 seconds.

### Patient Queue

- A new patient can be added with a required primary resource type and urgency.
- Waiting patients appear in the correct priority order.

### Matching

- When a compatible resource becomes available, the system can identify the highest-priority eligible waiting patient.
- The client can explain why that patient was selected.

### Safe Allocation

- A resource can be successfully committed to at most one patient.
- Two simultaneous/concurrent commit attempts against the same resource (two client instances, or two `HttpClient` calls) result in at most one success.
- A failed allocation does not create a false successful patient/resource state.

### Traceability

- Every meaningful patient/resource state change creates an audit event.
- Events cannot be edited or deleted through the application.
- Patient history is displayed in chronological order.

### Persistence

- **Closing and reopening the desktop client** does not lose state — all state lives in the backend's SQLite file, not in client memory.
- Restarting the backend process, then the client, still shows the correct persisted state.
- Rerunning the seed routine restores a clean, consistent demo state.

### Relay Readiness

- A fresh clone can be started using README instructions (`dotnet run` for both API and client).
- The API can be explored through `/swagger`.
- Known limitations and next-team ideas are documented.

---

## 15. QA Test Matrix

| Scenario | Expected Result |
|---|---|
| Add patient | Patient appears in waiting queue |
| Free a compatible resource | Dashboard updates; matching may trigger |
| Commit a resource | Resource becomes `committed` and patient state updates |
| Commit the same resource twice from two client instances | At most one succeeds; other receives a conflict response |
| Release a wrong allocation | Resource returns to `available`; release event is recorded |
| Discharge patient | Patient becomes `discharged`; resource is freed; matching runs |
| Close and reopen the client | State persists from the backend DB |
| Restart the backend process | State persists from the SQLite file on disk |
| Rerun seed routine | Fresh, consistent demo state restored |
| Open patient history | Full ordered event list shown |
| Attempt invalid resource transition | Backend rejects it safely (4xx, no partial write) |

---

## 16. Demo Script — 3 Minutes

Open with:

> "Every action you're about to see maps directly to one of the four requirements: visibility, matching, no double-booking, and full traceability."

### Demo Flow

1. Show the dashboard: emergency department has 7 patients waiting and only 2 ICU beds available.
2. Make ICU bed B102 available.
3. The system recommends the highest-priority compatible patient and displays why.
4. Click Allocate.
5. Dashboard updates and the patient moves to the next state.
6. **Launch a second instance of the desktop client** (or use a second workstation on the same LAN) and attempt to allocate B102 to another patient.
7. Show the allocation being blocked by the backend.
8. Open the original patient's history.
9. Show the complete ordered audit trail.

### Desired story

```text
Invisible capacity
      ↓
Visible dashboard
      ↓
Patient waiting
      ↓
Resource becomes available
      ↓
Explainable match
      ↓
Safe allocation
      ↓
Complete history
```

---

## 17. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Merge conflicts | Vertical slices, separate files where practical, merge every ~20 min |
| Client blocked by backend | Use mocked DTOs (from `HospitalFlow.Core`) matching the agreed contract when needed |
| Double-booking race | Conditional atomic DB update in WAL mode; never rely only on client-side state |
| State/history drift | Update state and insert audit event in the same transaction |
| Scope creep | Hard cap at two WOW features; 11:00 PM code freeze is non-negotiable |
| Manual DB changes bypass audit trail | Use application endpoints (release/discharge) instead of direct SQLite edits |
| Overengineering by AI | Follow this PRD; do not introduce unnecessary dependencies or architectural changes |
| Unsafe release | Release must identify the affected patient and write an audit event |
| Confusing staff semantics | Treat staff as operational capacity units, not individual scheduling |
| Multi-resource complexity | One primary resource per patient in Sprint 1 |
| **Windows Firewall prompt on first Kestrel launch** | Run the API on `localhost` for a single-machine demo to dodge the prompt entirely; if a real second workstation is needed, click "Allow" ahead of the judge walkthrough, not during it |
| **SQLite file locked/"database is busy"** | WAL mode (§7) plus short, explicit transactions (§9) — avoid holding a transaction open across a network round-trip |
| **Port conflict on 5080 with another local service** | Pick and document one port in `appsettings.json`; don't let it float |
| **Two client instances writing to the same `%LOCALAPPDATA%` cache/config** | Client stores no local state beyond window position — all real state stays server-side, so this can't cause drift |

---

## 18. AI Implementation Rules

When using Antigravity or other coding agents:

1. Do not rewrite the project from scratch after the foundation exists.
2. Follow this PRD's architecture and scope unless the team explicitly approves a change.
3. Prefer small, modular changes.
4. Do not introduce dependencies (NuGet packages) without a clear reason.
5. Preserve existing working functionality.
6. Run the relevant tests or manual verification after changes.
7. Do not modify unrelated files.
8. Explain major architectural changes before applying them.
9. Keep implementation understandable to the next relay team.
10. Do not add clinical decision-making or medical diagnosis logic.
11. Do not silently switch WPF → WinUI 3 (or vice versa) mid-build — that's an architectural change per rule 8.

---

## 19. Handoff Deliverables

Before the final Git push:

### `README.md`

Must contain:

- Overview
- Tech stack (.NET version, ASP.NET Core Minimal API, SQLite, WPF)
- How to run the backend (`dotnet run --project HospitalFlow.Api`)
- How to run the client (`dotnet run --project HospitalFlow.Client`)
- How to seed/reset demo data
- Architecture summary
- Solution/folder structure
- Matching logic summary
- Known limitations (single-machine demo networking, no auth, no installer)
- Link to Swagger `/swagger`

### `TODO.md`

Separate:

**Completed**

- Capacity dashboard
- Patient queue
- Matching engine
- Safe allocation
- Audit trail

**Next-team ideas**

- Notifications (including Windows Toast)
- Predictive capacity
- Role selector/authentication (possibly Windows/AD integration)
- Advanced scheduling
- Multi-resource allocation
- True push-based updates (SignalR)
- WinUI 3 / Fluent redesign
- MSIX packaging for real deployment

### `appsettings.example.json` (replaces `.env.example`)

Include every configuration value required to run the project — DB file path, API port, any CORS origin needed for the client.

### Seed routine

Must regenerate a consistent demo state and be safe to rerun.

### Git Requirements

- No force-push
- Preserve commit history
- Push the final stable state before handoff
- Do not leave uncommitted critical work

---

## 20. Final Scope Rule

When in doubt, prioritize in this order:

```text
1. Working end-to-end MVP
2. Correct resource safety / no double-booking
3. Complete traceability
4. Clear capacity visibility
5. Explainable matching
6. Polished UI
7. WOW features
8. Everything else
```

**A smaller system that works reliably is better than a larger system that is incomplete or difficult for the next relay team to understand.**
