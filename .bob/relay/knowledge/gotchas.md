# Gotchas

Structured entries below back the JSON shape in `cli/src/types.ts`
(`KnowledgeEntry`). This file is the human-readable index; the CLI's
`compile` step (Sprint 2) will parse entries like these into
`dashboard/public/relay-data.json`.

Each entry is a `## gotcha-NNN - Title` heading followed by these fields, in
order: `discoveredIn`, `discoveredAt`, `costMinutes`, `symptom`, `rootCause`,
`fix`, `watchOut`, `codeRefs`, `stalenessCheck`.

No entries yet.

## gotcha-001 - getRequestNow() uses local-time components but appends literal "Z"

- **discoveredIn:** T-000-mariam
- **discoveredAt:** 2026-09-25T15:00:00Z
- **costMinutes:** 25
- **symptom:** On non-UTC servers, `requestRefund()` rejected bookings younger than 30 days or wrongly flagged them for manual review. Boundary test under `TZ=Etc/GMT-2` showed an 89-day-old booking appearing 91 days old.
- **rootCause:** `getRequestNow()` in `src/lib/requestContext.ts:7` assembles an ISO timestamp from local `Date` component getters (`getHours()`, `getMinutes()`, etc.) then appends a literal `"Z"`. On non-UTC hosts this produces a string that claims to be UTC but contains local wall-clock numbers, up to ±14 h off. `getPurchaseAgeDays()` parsed this back with `new Date(getRequestNow()).getTime()`, so all elapsed-time arithmetic inherited the offset.
- **fix:** Replaced `new Date(getRequestNow()).getTime()` in `getPurchaseAgeDays()` with `Date.now()`. Removed the `getRequestNow` import from `validators.ts`. New `changeBooking()` uses `Date.now()` or a caller-supplied `requestedAt` for deterministic testing — never `getRequestNow()`.
- **watchOut:** `getRequestNow()` is display-only (invoice formatting). Never use it in any comparison, arithmetic, or Date constructor used for elapsed-time calculation.
- **codeRefs:** `hackathon-specific/sample-project/src/lib/requestContext.ts:7`, `hackathon-specific/sample-project/src/refunds/validators.ts:9`
- **stalenessCheck:** Re-verify if `requestContext.ts` is ever refactored to use `Date.now()` or `new Date().toISOString()` — at that point `getRequestNow()` becomes safe for arithmetic and this warning can be retired.
