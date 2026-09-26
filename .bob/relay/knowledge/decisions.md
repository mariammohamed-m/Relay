# Decisions

Cross-task architectural decisions worth remembering - not per-task choices
(those live in each task's `02-plan.md`).

---

## DEC-001 — Use `Date.now()` / `new Date().toISOString()` for all elapsed-time arithmetic; never `getRequestNow()`

**Decided in:** T-000-mariam
**Context:** `getRequestNow()` in `sample-project/src/lib/requestContext.ts` assembles an ISO string from local date components and appends a literal `"Z"`. Any consumer feeding that string into `new Date(...).getTime()` inherits a ±14 h offset on non-UTC servers, silently breaking date-window checks.
**Decision:** All elapsed-time and boundary arithmetic must use `Date.now()` directly, or `new Date().toISOString()` where a string form is needed. For deterministic testing, functions that need "now" must accept an optional `requestedAt` parameter so tests can supply a fixed timestamp without mocking the clock.
**Scope:** `hackathon-specific/sample-project/` (and any future service projects in this repo).
**Cross-ref:** gotcha-001, `architecture.md §7 Known Sharp Edges`.

---

## DEC-002 — Service-layer functions with date logic must accept an optional `requestedAt` for deterministic testing

**Decided in:** T-000-mariam
**Context:** `changeBooking()` needs to compare "now" against a flight's `departsAt`. Injecting `Date.now()` into tests via module mocking is fragile. A caller-supplied `requestedAt?: number` parameter is simpler and explicit.
**Decision:** Any service function whose correctness depends on "now" must accept `requestedAt?: number` (milliseconds epoch). When absent, default to `Date.now()`. Tests always supply a fixed value.
**Scope:** `hackathon-specific/sample-project/src/bookings/bookingService.ts` and future service files.
**Cross-ref:** DEC-001, `03-implementation.md §Step 4`, `05-tests.md §AC-8`.
