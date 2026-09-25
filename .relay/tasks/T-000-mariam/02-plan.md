# 02-plan.md — T-000 mariam

Closes **REF-88** (30-day refund window) and **REF-91** (7-day flight-change fee).

## Overview

Two independent feature slices sharing one prerequisite: fixing the `getRequestNow()` timezone
bug in `validators.ts` before either slice's date arithmetic can be trusted.

---

## Step 1 — Fix `getPurchaseAgeDays()` timezone bug

**Files:** `hackathon-specific/sample-project/src/refunds/validators.ts`

Replace `new Date(getRequestNow()).getTime()` with `Date.now()` on the "now" side of the
age calculation. `getRequestNow()` uses local date components + literal `"Z"` which is wrong
on non-UTC hosts. `Date.now()` is always UTC epoch ms.

**Risks:** None — `Date.now()` is a direct drop-in; no callers change signature.

---

## Step 2 — REF-88: enforce 30-day hard refund cutoff (AC-1, AC-2)

**Files:**
- `hackathon-specific/sample-project/src/refunds/validators.ts`
- `hackathon-specific/sample-project/src/refunds/refundService.ts`

**validators.ts:**
- Change `MANUAL_REVIEW_AGE_DAYS` to `REFUND_WINDOW_DAYS = 30`.
- In `isEligibleForRefund()`: if `ageDays > REFUND_WINDOW_DAYS`, return
  `{ eligible: false, needsManualReview: false, reason: 'REFUND_WINDOW_EXPIRED' }`.
- Keep a separate `MANUAL_REVIEW_AGE_DAYS = 90` threshold above which confirmed-but-old
  bookings are still flagged for manual review (preserves existing behaviour for edge cases).

**refundService.ts:**
- In `requestRefund()`: when `!eligibility.eligible` and `eligibility.reason === 'REFUND_WINDOW_EXPIRED'`,
  set `refund.reasonCode = 'REFUND_WINDOW_EXPIRED'` instead of the generic `'NOT_ELIGIBLE'`.

**Risks:** The existing `reasonCode` field on `RefundRequest` is `string | null` — no schema change needed.

---

## Step 3 — REF-88: admin override + audit log (AC-3, AC-5)

**Files:**
- `hackathon-specific/sample-project/src/refunds/refundService.ts`
- `hackathon-specific/sample-project/src/refunds/adminOverride.ts` (already exists, dead code)

**refundService.ts** — add `overrideRefund(refundId: string, adminUser: User): RefundRequest`:
- Load the refund request; throw `NotFoundError` if missing.
- Call `canOverrideRefund(adminUser)` from `adminOverride.ts`; throw `ValidationError` if false.
- Set `refund.status = 'approved'`, `refund.reasonCode = 'ADMIN_OVERRIDE'`,
  `refund.decidedAt = new Date().toISOString()`, `refund.overriddenByUserId = adminUser.id`.
- Append an audit event to an in-memory `auditLog: AuditEvent[]` array (new export from `db.ts`):
  `{ type: 'refund_override', refundId, adminUserId: adminUser.id, at: new Date().toISOString() }`.
- Mark the associated booking `status = 'refunded'`.

**db.ts** — add `AuditEvent` interface and `auditLog` array to the store; reset in `resetDb()`.

**Risks:** `canOverrideRefund` checks `user.permissions.includes('refunds:override')` — seed data
must include at least one admin user with that permission for tests to work.

---

## Step 4 — REF-91: flight-change fee (AC-6, AC-7, AC-8)

**Files:**
- `hackathon-specific/sample-project/src/bookings/bookingService.ts`
- `hackathon-specific/sample-project/src/lib/db.ts` (possibly — if `Payment` needs a `type` discriminator)

Add `changeBooking(bookingId: string, newFlightId: string, requestedAt?: string): { booking: Booking, feeCents: number }`:

- Load the original booking and the new flight via existing getters.
- Compute days-until-departure: `Math.floor((new Date(newFlight.departsAt).getTime() - (requestedAt ? new Date(requestedAt).getTime() : Date.now())) / DAY_MS)`.
- **Never use `getRequestNow()`** — use `Date.now()` or the caller-supplied `requestedAt` (ISO UTC string). This satisfies AC-8.
- If `daysUntilDeparture >= 7`: no fee (AC-6). Update `booking.flightId`.
- If `daysUntilDeparture < 7`: apply `CHANGE_FEE_CENTS` per fare class (AC-7), create a `Payment` record, update `booking.flightId`.
- Return the updated booking and the fee charged (0 if none).

**Fee config:** add `const CHANGE_FEE_CENTS = { economy: 5000, business: 15000 }` in `bookingService.ts` — same pattern as `SEAT_CLASS_MULTIPLIER`.

**Risks:** `Flight.departsAt` is already UTC ISO 8601 per the `db.ts` comment — arithmetic is safe.
The optional `requestedAt` param enables deterministic testing without mocking `Date.now()`.

---

## Step 5 — Tests

**Files:** `hackathon-specific/sample-project/tests/refund.spec.ts` (extend),
new `hackathon-specific/sample-project/tests/flight-change.spec.ts`

| AC   | Test description |
|------|-----------------|
| AC-1 | `requestRefund` on a 31-day-old booking returns `status: 'rejected'` |
| AC-2 | Same case has `reasonCode: 'REFUND_WINDOW_EXPIRED'` |
| AC-3 | `overrideRefund` by an admin user approves a rejected refund |
| AC-5 | After override, `db.auditLog` contains entry with `adminUserId` + `at` |
| AC-6 | `changeBooking` with departure ≥ 7 days away returns `feeCents: 0` |
| AC-7 | `changeBooking` with departure < 7 days returns correct fee for each fare class |
| AC-8 | Boundary computed correctly when system TZ ≠ UTC (supply `requestedAt` near midnight UTC) |

AC-4 remains `testable: false` — no SLA number from Product.

---

## Alternatives considered

| Approach | Rejected because |
|----------|-----------------|
| Fix `getRequestNow()` itself to use `getUTCHours()` etc. | The function is used for display strings where local time is intentional; silently changing it would break those callsites. Safer to stop using it in arithmetic. |
| Add `refund_window_days` to the `Flight` or `Booking` type | No ticket asks for per-booking windows; a module-level constant in `validators.ts` is the right scope. |
| Store audit log outside `db.ts` | Keeping it in the in-memory store makes `resetDb()` clean it up automatically, which tests require. |
| Compute change-fee in the route handler | Business logic belongs in the service layer, consistent with how `requestRefund` works. |
