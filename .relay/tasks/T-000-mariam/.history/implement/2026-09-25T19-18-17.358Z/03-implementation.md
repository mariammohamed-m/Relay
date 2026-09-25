# 03-implementation.md — T-000 mariam

## What was built

All five plan steps implemented, all 22 tests passing.

### Step 1 — Fix `getPurchaseAgeDays()` timezone bug
`src/refunds/validators.ts`: replaced `new Date(getRequestNow()).getTime()` with `Date.now()`.
Removed the now-unused `getRequestNow` import. This fixes the UTC+N host drift documented in the boundary spec.

### Step 2 — 30-day hard refund cutoff (AC-1, AC-2)
`src/refunds/validators.ts`: added `REFUND_WINDOW_DAYS = 30` constant. Added early-return branch in `isEligibleForRefund()`: if `ageDays > REFUND_WINDOW_DAYS`, returns `{ eligible: false, needsManualReview: false, reason: 'REFUND_WINDOW_EXPIRED' }`. The existing `MANUAL_REVIEW_AGE_DAYS = 90` branch is preserved for the manual-review path (unreachable under normal flow now, but not removed in case the window constant changes in future).

`src/refunds/refundService.ts`: `requestRefund()` now propagates `eligibility.reason === 'REFUND_WINDOW_EXPIRED'` to `refund.reasonCode` instead of the generic `'NOT_ELIGIBLE'`.

### Step 3 — Admin override + audit log (AC-3, AC-5)
`src/lib/db.ts`: added exported `AuditEvent` interface (`type`, `refundId`, `adminUserId`, `at`) and `auditLog: AuditEvent[]` array to the `Store` shape. `emptyStore()` initialises it to `[]`, so `resetDb()` clears it automatically.

`src/refunds/refundService.ts`: new exported `overrideRefund(refundId, adminUser)` function. Loads the refund, checks `canOverrideRefund()` (throws `ValidationError` on failure), sets `status='approved'`, `reasonCode='ADMIN_OVERRIDE'`, `decidedAt`, `overriddenByUserId`, marks the booking `status='refunded'`, and appends an audit event.

### Step 4 — Flight-change fee (AC-6, AC-7, AC-8)
`src/bookings/bookingService.ts`: added `CHANGE_FEE_CENTS = { economy: 5000, business: 15000 }` constant and `changeBooking(bookingId, newFlightId, requestedAt?)` function. Uses `Date.now()` (or caller-supplied `requestedAt` for deterministic testing) exclusively — `getRequestNow()` never touched. Fee applied when `daysUntilDeparture < 7`; a `Payment` record written to `db.payments`. Returns `{ booking, feeCents }`.

### Step 5 — Tests
`tests/refund.spec.ts`: extended with AC-1, AC-2, AC-3, AC-5 tests. Removed the now-incorrect "older than 90 days flagged for manual review" test (a 91-day booking now hits the 30-day window first and is rejected, not flagged).

`tests/flight-change.spec.ts` (new): AC-6, AC-7 (economy + business), AC-8 (UTC boundary near midnight). Uses deterministic `requestedAt` parameter to avoid real-time coupling.

## Deviations from plan

None. All steps implemented exactly as specified.

## Notes for reviewer

- The `MANUAL_REVIEW_AGE_DAYS = 90` branch in `validators.ts` is now unreachable under the current constant values (30 < 90). It is intentionally kept so that if `REFUND_WINDOW_DAYS` is raised above 90, the manual-review path still applies. If product confirms the 30-day window is permanent, the branch can be removed.
- The old "a booking older than 90 days is flagged for manual review" test was removed from `refund.spec.ts` because it contradicts the new AC-1 behaviour (31+ day bookings are now rejected). The boundary spec (`refund-window.boundary.spec.ts`) is unchanged and still documents the pre-fix bug.
