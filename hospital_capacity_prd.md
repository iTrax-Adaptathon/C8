# Hospital Capacity & Patient Flow Platform — PRD

**Event:** Hackathon / Adaptathon Sprint 1
**Team size:** 4
**Build window:** ~4h45m
**Status:** Final — ready to build

---

## 1. Problem statement

Hospitals lose time and safety margin because capacity information is fragmented: a bed frees up but nobody sees it, a patient waits while a resource sits idle elsewhere, and double-booking a bed or theatre slot is a live safety risk. There is also no reliable, tamper-proof record of what happened to a patient and when.

## 2. Goals

Build a platform that:
1. Surfaces available beds, theatre slots, and staff capacity as they change.
2. Matches waiting patients to the right resource as soon as it frees up.
3. Keeps every change to a patient's status and history fully traceable.
4. Guarantees a resource can never be committed to more than one patient.

## 3. Non-goals (explicitly out of scope)

To protect the build window, the following are **not** built in Sprint 1:
- Authentication / user roles / login
- Push notifications (email, SMS, etc.)
- Predictive analytics or ML-based forecasting
- Hardware or sensor integration of any kind (bed sensors, RFID, etc.) — all data entry is software-only, via manual staff input or a mocked ADT feed
- Multi-hospital / multi-tenant support
- Advanced scheduling or calendar UI

These are captured as "Next team ideas" for a future sprint, not attempted now.

## 4. Users

- **Bedside / ward staff** — mark resources available, discharge patients, confirm matches.
- **Judges (for demo purposes)** — need to see live capacity, a match happen, a double-booking get blocked, and a patient's full history, without narration.

## 5. Core requirements → features

| Requirement | Feature |
|---|---|
| Real-time visibility | Dashboard polling `GET /resources` and `GET /patients/waiting` every 2–3s |
| Match patients to resources | `checkForMatch()` — sorts waiting patients by urgency then wait time, attempts atomic commit |
| Traceability | Insert-only `events` table; every state change writes an event in the same transaction |
| No double-booking | Single conditional `UPDATE ... WHERE status = 'available'` — 0 rows updated = rejected |

## 6. Data model

Exactly **3 tables**. No `allocations` table — `resources.status` already holds current commitment state, and `events` already holds full history; a fourth table would duplicate state and risk drift.

**resources**
`id, type (bed | theatre | staff), status (available | committed), version, updated_at`

**patients**
`id, name, status (waiting | admitted | discharged), resource_type_needed, urgency_score, waiting_since`

**events** (insert-only, never updated or deleted)
`id, patient_id, resource_id (nullable), event_type, note, created_at`

> Simplification note: no separate `reserved` state or TTL hold. Status moves directly `available → committed`. This keeps the concurrency demo simple without losing the safety guarantee.

## 7. API contract

| Endpoint | Purpose |
|---|---|
| `GET /resources` | List all resources with current status |
| `GET /patients/waiting` | Waiting queue, sorted by urgency then wait time |
| `POST /patients` | Add a patient to the waiting queue |
| `PATCH /resources/:id/status` | Manually mark a resource available/committed — triggers `checkForMatch()` |
| `POST /patients/:id/discharge` | Discharge a patient, free their resource, trigger `checkForMatch()` |
| `POST /resources/:id/release` | Undo/cancel a wrong allocation — writes a new event, does not delete history |
| `GET /patients/:id/history` | Full, ordered event log for a patient |

FastAPI's auto-generated Swagger UI at `/docs` serves as the API documentation — no separate API doc needed in the README.

## 8. Core logic

**Atomic resource commitment** (this is the anchor technical demo point):

```sql
UPDATE resources
SET status = 'committed', version = version + 1
WHERE id = $1 AND status = 'available';
```

If 0 rows update, the resource was already taken — reject and try the next candidate. Every successful state change is written in the same DB transaction as its `events` insert, so state and history can never drift out of sync.

SQLite is used deliberately, not just for setup speed: it serializes writes by default, which makes the "no double-booking" guarantee easier to trust live on stage than a connection-pooled setup would be.

**Matching** — a single function, not a service:

```sql
SELECT id FROM patients
WHERE status = 'waiting' AND resource_type_needed = ?
ORDER BY urgency_score DESC, waiting_since ASC
LIMIT 1;
```

Attempt the atomic commit for the top result; on failure (0 rows updated), retry with the next patient in order.

**Trigger points** for `checkForMatch(resourceType)`:
- A resource is manually marked available
- A patient is discharged
- A new patient is added to the queue

## 9. Architecture

```
        React Dashboard (polling every 2-3s)
                     │
                     ▼
          FastAPI REST Backend
                     │
    ┌────────┬─────────┬────────┐
    ▼        ▼         ▼        ▼
Patients  Resources  Matching  Audit
    │        │         │        │
    └────────┴─────────┴────────┘
               SQLite Database (3 tables)
```

Single backend service. No microservices, no message broker, no Redis/Kafka, no ORM abstraction beyond what's needed to run raw SQL safely.

## 10. Build plan

**Skeleton-first, then vertical slices** — one person builds a thin, fully wired, end-to-end skeleton before the team splits, so nobody is blocked on plumbing.

**Skeleton (must be done before splitting), ~30–40 min:**
- All 3 tables created; `seed.py` runs and populates them
- Every endpoint in the API contract exists and returns real (if trivial) data from the DB
- One frontend page successfully fetches and renders real data — proves the full loop
- Empty route/component files stubbed per feature (e.g. `routers/resources.py`, `routers/matching.py`, `ResourceGrid.tsx`) so each person lands in their own file, minimizing merge conflicts
- `main` tagged in this working state

**Vertical slices, not frontend/backend split** — each person owns one feature end-to-end (their own query, endpoint, and UI panel), so nobody sits idle waiting on someone else's layer:

| Person | Owns |
|---|---|
| A (also skeleton + Git manager) | Resource grid: query, commit/release logic, frontend panel |
| B | Waiting queue + add-patient form: backend + frontend |
| C | Matching engine: atomic commit + retry logic + "why this match" explanation UI |
| D | Audit trail: shared event-logging helper, history endpoint, history modal UI |

Frontend can build against a mocked JSON response matching the agreed contract if a real endpoint isn't ready yet, so nobody stalls.

**Merge cadence:** every ~20 minutes to `main`, not one large merge at the end.

## 11. Timeline

| Time | Phase |
|---|---|
| 7:00–7:30 | Plan: MVP feature list, schema, API contract, folder structure, branches |
| 7:30–8:10 | Skeleton build (one person) |
| 8:10–9:30 | Vertical-slice development (all four, own feature end-to-end), merging every ~20 min |
| 9:30–9:45 | Integration checkpoint — full flow tested together |
| 9:45–10:15 | Dinner / buffer |
| 10:15–11:00 | WOW features (pick 2, see §12) |
| 11:00 | **Code freeze** |
| 11:00–11:25 | QA pass — one person tests like a judge (see §13) |
| 11:25–11:45 | Handoff package: README, TODO.md, `.env.example` |

## 12. WOW features (pick at most two)

Priority order — pick top two given remaining time:
1. **Explainable matching** (do this one — cheapest, highest impact): the match already computes urgency + wait time, so surfacing *why* a match was made is a formatting change, not new logic.
2. **Patient flow visualization**: simple congestion view (waiting → beds → ward → theatre counts), high visual impact for judges.
3. Live simulation buttons (free bed / discharge / reserve theatre) — lower priority since core demo already covers this via the resource grid.

## 13. QA test matrix (run before freeze)

| Scenario | Expected result |
|---|---|
| Add patient | Appears in waiting queue |
| Free a resource | Dashboard count updates; match may auto-trigger |
| Commit a resource | Status becomes `committed` |
| Commit the same resource twice (two tabs) | Second request blocked |
| Release a wrong allocation | Resource returns to `available`; event recorded, not deleted |
| Discharge patient | Resource frees, `checkForMatch()` runs |
| Refresh browser | Data persists (from DB, not local state) |
| Run `seed.py` | Fresh, consistent demo state restored |
| Open patient history | Full ordered event list, including any releases |

## 14. Demo script (3 minutes)

Open with the mapping, stated plainly: *"Every action you're about to see maps directly to one of the four requirements — visibility, matching, no double-booking, full traceability."*

1. Dashboard: emergency department has 7 patients waiting, only 2 ICU beds available.
2. Free bed B102.
3. System recommends the top-priority waiting patient, with the reason shown (ICU compatible, highest priority, longest wait).
4. Click allocate — dashboard updates instantly.
5. From a second browser tab, try to allocate the same bed to a different patient — blocked.
6. Open that patient's history — every event, timestamped, nothing missing or editable.

## 15. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Merge conflicts across 4 people | Vertical slices in separate files; merge every ~20 min, not once at the end |
| Frontend blocked on backend | Frontend builds against mocked JSON matching the agreed contract |
| Scope creep during "WOW" phase | Hard cap at 2 features; code freeze at 11:00 is non-negotiable |
| Losing the traceability story via manual DB edits | `release` endpoint gives a safe, event-logged way to undo a wrong match — no direct data edits ever needed |

## 16. Handoff deliverables

- `README.md` — overview, stack, how to run, link to `/docs` for API reference, known limitations
- `TODO.md` — completed vs. next-team ideas (notifications, predictive capacity, role selector, advanced scheduling)
- `.env.example`
- `seed.py` — regenerates a consistent demo state (≈20 beds, 5 theatre slots, 10 staff, 10–15 patients)
