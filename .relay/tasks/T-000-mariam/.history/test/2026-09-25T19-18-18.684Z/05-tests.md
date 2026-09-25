# 05-tests.md — T-000 mariam

**Test runner:** `node:test` (no Vitest/Jest) via `npm test` in `hackathon-specific/sample-project/`.  
**Result:** 22 / 22 pass. 0 failures.

---

## Criterion → test mapping

| AC | Testable | Covered | Test ref | Notes |
|----|----------|---------|----------|-------|
| AC-1 | ✅ | ✅ | [`refund.spec.ts:61`](hackathon-specific/sample-project/tests/refund.spec.ts:61) | Booking purchased 31 days ago → rejected |
| AC-2 | ✅ | ✅ | [`refund.spec.ts:73`](hackathon-specific/sample-project/tests/refund.spec.ts:73) | `reasonCode === "REFUND_WINDOW_EXPIRED"` asserted |
| AC-3 | ✅ | ✅ | [`refund.spec.ts:85`](hackathon-specific/sample-project/tests/refund.spec.ts:85) | Admin override flips status to `"approved"`, `reasonCode` to `"ADMIN_OVERRIDE"` |
| AC-4 | ❌ not testable | — | — | No SLA bound in ticket. Left uncovered (see below). |
| AC-5 | ✅ | ✅ | [`refund.spec.ts:101`](hackathon-specific/sample-project/tests/refund.spec.ts:101) | `db.auditLog[0].adminUserId` and `.at` both asserted |
| AC-6 | ✅ | ✅ | [`flight-change.spec.ts:42`](hackathon-specific/sample-project/tests/flight-change.spec.ts:42) | 10-day departure → `feeCents === 0` |
| AC-7 | ✅ | ✅ | [`flight-change.spec.ts:55`](hackathon-specific/sample-project/tests/flight-change.spec.ts:55) + `:66` | Economy 5000, business 15000 — two cases |
| AC-8 | ✅ | ✅ | [`flight-change.spec.ts:79`](hackathon-specific/sample-project/tests/flight-change.spec.ts:79) | `requestedAt = 23:45 UTC`, departure exactly 7 days later → `feeCents === 0` |

---

## Boundary cases covered

- **AC-1 boundary:** 31-day booking rejected; 5-day and 2-day bookings approved (pre-existing tests).
- **AC-7 boundary (two fare classes):** Economy (5000 ¢) and business (15000 ¢) both exercised with identical departure offsets.
- **AC-8 UTC boundary:** `requestedAt` set to 23:45 UTC (near midnight). Departure at exactly +7 × 86400 s (millisecond-exact). Uses pure `Date.now()`-arithmetic path — confirms no local-timezone leakage from `getRequestNow()`.

---

## Regression test for debug note

The root-cause fix (replacing `new Date(getRequestNow()).getTime()` with `Date.now()` in [`validators.ts:9`](hackathon-specific/sample-project/src/refunds/validators.ts:9)) is exercised indirectly by AC-1 and AC-8: both require correct elapsed-time arithmetic that would silently drift on non-UTC hosts if `getRequestNow()` were re-introduced. The dedicated planted-bug regression (`tests/refund-window.boundary.spec.ts`) runs separately under `npm run test:planted-bug` and deliberately asserts the broken behaviour to serve as a permanent demo artifact — it is intentionally excluded from `npm test`.

---

## Uncovered criteria

**AC-4 — "Refunds should be processed promptly"**  
`testable: false`. No SLA bound appears anywhere in REF-88. There is no measurable pass/fail condition to write a test against. This criterion must stay uncovered until Product (Elena Cho) supplies a concrete latency target and load definition.
