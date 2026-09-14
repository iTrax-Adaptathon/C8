# TODO

## Completed

- [x] FastAPI backend with layered architecture (`api` → `services` → `repositories` → `domain`)
- [x] SQLite with WAL, foreign keys and a 30 s busy timeout
- [x] Exactly 3 tables: `resources`, `patients`, `events` (events insert-only)
- [x] `seed.py` — idempotent reset to a predictable demo state
- [x] All contract endpoints + `/docs` Swagger, `/health`, `/resources`, `/patients/waiting`,
      `POST /patients`, `PATCH /resources/{id}/status`, `POST /resources/{id}/allocate`,
      `POST /resources/{id}/release`, `POST /patients/{id}/discharge`,
      `GET /patients/{id}/history`
- [x] Atomic conditional allocation (`UPDATE ... WHERE status='available'`), 409 on conflict
- [x] State change + audit events written in the same DB transaction
- [x] Matching engine: urgency DESC, `waiting_since` ASC, with explainable reasons
- [x] Trigger points for matching (resource available, discharge, new patient, release)
- [x] React + TypeScript + Vite + Tailwind dashboard matching the clinical teal theme
- [x] Capacity tiles, patient-flow bottleneck strip, waiting queue, resource grid
- [x] Explainable recommended-match panel with reasons checklist
- [x] Patient history timeline modal
- [x] Double-booking race simulator card (AC-5) and inline 409 rejection messaging
- [x] Electron desktop shell (dev server + production `dist` loading)
- [x] TanStack Query polling every 2.5 s (no WebSockets)
- [x] pytest suite: matching order/tie-break, concurrent allocation, 409, release/discharge,
      read-only audit surface (10 tests passing)
- [x] README, `.env.example`, `.gitignore`

## Design decisions (simplest choice that satisfies the acceptance criteria)

- **`patients.current_resource_id` added.** The spec's patient columns do not include a
  resource pointer, but `POST /patients/{id}/discharge` must know which resource to free.
  Options were (a) add one nullable column or (b) scan `events` for the last unconsumed
  `resource_committed`. We chose (a): still exactly 3 tables, far clearer for the relay
  team. Current *state* is on `resources.status`; full *history* remains in `events`.
- **Recommendation vs. auto-allocation.** The matching spec can be read as auto-committing
  on trigger. We made matching produce a live recommendation (`GET /matches`) and kept
  `POST /resources/{id}/allocate` as an explicit, human-triggered atomic action. This is
  required for the demo ("System recommends … click allocate") and for the AC-5 race demo.
  Trigger points still append a deduplicated `match_recommended` audit event.
- **Release returns the patient to `waiting`** (`admitted -> waiting`), extending the
  documented state machine, because release is described as "undo a wrong allocation".
  `waiting_since` is preserved so the patient keeps their original priority.
- **`waiting -> discharged` allowed** so a queued patient can leave before admission.
- **Extra read endpoints** `GET /patients`, `GET /matches`, `GET /events/recent` were added
  beyond the minimum contract to power the dashboard and audit feed. They are read-only.
- **Insert-only enforced at the application layer** (no mutating route for `events`); no DB
  trigger, per the PRD's "append-only application audit trail, not cryptographic" note.
- **Frontend design follows the supplied dashboard reference** (top navigation, soft
  off-white canvas, white rounded cards, teal `#0d9488` accent, traffic-light status dots)
  rather than the earlier left-sidebar fallback description.

## Known issues

- Concurrency guarantee relies on SQLite's single-writer behaviour (fine for one machine,
  not for a networked multi-writer deployment).
- `match_recommended` events are best-effort; rapid toggling of a resource could append a
  duplicate recommendation if the latest event for that resource is a release.
- No optimistic UI: mutations wait for the round trip, then queries invalidate.
- The waiting/ward bottleneck "Ward" stage is derived from bed occupancy, not a real ward
  entity.

## Suggested next steps

- Notifications (email/SMS/desktop) when a match appears or capacity crosses a threshold.
- Predictive capacity analytics / forecasting (time-series on `events`).
- Role-based access (capacity admin vs. ward staff) and an audit of who did what.
- Advanced scheduling and calendar UI for theatre slots.
- Multi-resource atomic allocation (theatre + surgeon + anaesthesia as one unit).
- Richer bottleneck analytics and historical flow charts.
- Optional true push updates (SSE/WebSocket) replacing polling.
- Package the Electron app into a signed Windows installer.
