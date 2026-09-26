# 04-debug-notes.md — T-000 mariam

## Symptom

On non-UTC hosts, `requestRefund()` would incorrectly reject bookings younger than 30 days, or incorrectly flag bookings younger than 90 days for manual review. Boundary tests in `tests/refund-window.boundary.spec.ts` reproduced the failure under `TZ=Etc/GMT-2`: a booking purchased exactly 89 days ago would appear 91 days old, causing a hard rejection instead of auto-approval.

## Investigation path

1. Ran `npm test` — 22 tests pass, including the four new AC-6/7/8 flight-change tests from `flight-change.spec.ts`.
2. Ran `npm run test:planted-bug` — boundary spec still intentionally demonstrates the original bug (passes because the test asserts the wrong behaviour still occurs without the fix).
3. Traced call chain: `requestRefund()` → `isEligibleForRefund()` → `getPurchaseAgeDays()` → old code called `new Date(getRequestNow()).getTime()` for "now".
4. Found root cause in `src/lib/requestContext.ts:7`: `getRequestNow()` assembles local date components (`d.getHours()` etc.) but appends a literal `"Z"` — claims UTC while containing local wall-clock numbers.
5. Confirmed the fix in `src/refunds/validators.ts`: `getPurchaseAgeDays()` now uses `Date.now()` directly (replaced in the implement stage).
6. Confirmed `changeBooking()` in `src/bookings/bookingService.ts` also uses `Date.now()` (or caller-supplied `requestedAt`) — never touches `getRequestNow()`.

## Root cause

`getRequestNow()` in [`src/lib/requestContext.ts:7`](hackathon-specific/sample-project/src/lib/requestContext.ts:7) constructs an ISO-8601 string using local `Date` component getters (`getHours`, `getMinutes`, etc.) and appends a literal `"Z"`. On any non-UTC server this produces a timestamp that claims to be UTC but contains local wall-clock numbers — up to ±14 h wrong. Every consumer that used this value for arithmetic (not just display) inherited the offset.

## Fix

In [`src/refunds/validators.ts:9`](hackathon-specific/sample-project/src/refunds/validators.ts:9): replaced `new Date(getRequestNow()).getTime()` with `Date.now()`. Removed the `getRequestNow` import. All date arithmetic now uses `Date.now()` or caller-supplied `requestedAt` (deterministic testing pattern in `changeBooking`).

## Approximate time cost

~25 minutes (tracing call chain through requestContext → validators → service layer, confirming fix, running boundary regression).
