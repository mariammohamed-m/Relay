# 08-docs.md — T-000 mariam

Flywheel closure: knowledge from this task folded into the durable base.

---

## Files updated

| File | What changed |
|------|-------------|
| `AGENTS.md` | Added `getRequestNow()` display-only rule to Critical gotchas. Added new §"Sample project — Meridian Travel Backend (T-000)" section covering test-reset pattern, no-HTTP-route policy for new service functions, quote-style divergence (V-2), unreachable branch intent, and boundary-spec exclusion. |
| `.relay/knowledge/architecture.md` | Marked T-000 completed. Updated `bookingService.ts` entry to include `changeBooking()`. Updated `db.ts` entry to note `AuditEvent` + `auditLog[]`. Updated `refundService.ts` to include `overrideRefund()`. Updated `adminOverride.ts` comment (no longer dead code). Added `AuditEvent` to Key data shapes table. |
| `.relay/knowledge/decisions.md` | Recorded DEC-001 (use `Date.now()` / never `getRequestNow()` for arithmetic) and DEC-002 (`requestedAt?` injection pattern for deterministic testing). |
| `.relay/knowledge/gotchas.md` | No changes needed — gotcha-001 was written during the debug stage and is correctly formatted. |

---

## Gotcha ids harvested this task

| ID | Title | Status in gotchas.md |
|----|-------|----------------------|
| gotcha-001 | `getRequestNow()` uses local-time components but appends literal "Z" | ✅ Present, correctly formatted |

---

## Open follow-up items (not blocking docs)

These review findings were not blockers and are not spec violations; flagged here for a future task:

| Finding | Description |
|---------|-------------|
| P-1 | `overrideRefund` allows re-approving already-approved/pending refunds |
| P-2 | `changeBooking` allows no-op same-flight change, creates spurious payment |
| C-1 | AC-1 exact 30-day boundary untested |
| C-2 | AC-3 test doesn't assert booking status becomes `'refunded'` |
| G-1 | No inline warning on `getRequestNow()` in `requestContext.ts` for future authors |
| V-1 | Stale comment in `adminOverride.ts` |
| V-2 | `bookingService.ts` uses single quotes; rest of project uses double quotes |
| V-3 | `changeBooking` and `overrideRefund` have no HTTP routes |
