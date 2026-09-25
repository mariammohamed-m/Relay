# 06-review.md — T-000 mariam

Four independent passes: plan fidelity, acceptance criteria, gotchas, project conventions.

---

## Pass 1 — Plan fidelity

Checking every step in `02-plan.md` against the implementation.

### Step 1 — Fix `getPurchaseAgeDays()` timezone bug ✅
`validators.ts:9` uses `Date.now()`. `getRequestNow` import removed. Matches plan exactly.

### Step 2 — 30-day hard cutoff (AC-1, AC-2) ✅
`validators.ts:3–4`: `REFUND_WINDOW_DAYS = 30` and `MANUAL_REVIEW_AGE_DAYS = 90` both present.
`isEligibleForRefund()` early-returns `REFUND_WINDOW_EXPIRED` at line 27–33. Plan specified keeping the manual-review branch; it is kept at line 34–39 (now unreachable given 30 < 90, which the implementation notes acknowledge).
`refundService.ts:25–28`: propagates `REFUND_WINDOW_EXPIRED` reason code. Matches plan.

### Step 3 — Admin override + audit log (AC-3, AC-5) ✅
`db.ts:56–61`: `AuditEvent` interface exported; `auditLog: AuditEvent[]` in `Store`; initialised in `emptyStore()`; `resetDb()` calls `emptyStore()` so it clears automatically. Matches plan.
`refundService.ts:48–66`: `overrideRefund()` loads refund, calls `canOverrideRefund()`, sets fields, marks booking `'refunded'`, appends audit event. All fields from plan present.

**Finding P-1 — LOW — `overrideRefund` does not throw when the refund is not in a rejected state**
`file: hackathon-specific/sample-project/src/refunds/refundService.ts:49`
The plan specifies "Load the refund request; throw NotFoundError if missing" — present. However, the plan also says `canOverrideRefund` is the only guard. The function currently allows overriding an already-approved or pending refund, which silently re-approves it. Not a spec violation (the plan doesn't explicitly require a status guard), but a latent correctness hole.
*Suggested fix:* Add `if (refund.status !== 'rejected') throw new ValidationError('Only rejected refunds can be overridden');` before the status assignment. Low severity because AC-3 only tests the rejected→approved path and no test currently exercises the non-rejected path.

### Step 4 — Flight-change fee (AC-6, AC-7, AC-8) ✅
`bookingService.ts:9`: `CHANGE_FEE_CENTS = { economy: 5000, business: 15000 }`. Matches plan.
`changeBooking()` at line 41–70: uses `Date.now()` or caller-supplied `requestedAt` (never `getRequestNow()`). Fee branch at line 57, payment record created and stored. Booking's `flightId` updated. Matches plan exactly.

**Finding P-2 — LOW — `changeBooking` does not guard against a non-confirmed booking changing to the same flight**
`file: hackathon-specific/sample-project/src/bookings/bookingService.ts:47–48`
Status guard correctly rejects non-confirmed bookings. However, a caller can change a booking to the same flight it already has; this creates a spurious payment record when within 7 days. Not in the plan's scope and not an AC, but worth noting as a latent data-quality issue.
*Suggested fix:* Add `if (booking.flightId === newFlightId) throw new ValidationError('Booking is already on that flight');` — single guard, no test changes needed. Low severity.

### Step 5 — Tests ✅
`refund.spec.ts`: AC-1 (line 61), AC-2 (73), AC-3 (85), AC-5 (101) all present and correct.
`flight-change.spec.ts`: AC-6 (42), AC-7 economy (55) + business (66), AC-8 UTC boundary (79) all present.
Removed test (91-day manual-review) is correctly absent. Matches plan.

---

## Pass 2 — Acceptance criteria

Checking each testable AC against the actual code paths and test assertions.

| AC | Status | Finding |
|----|--------|---------|
| AC-1 | ✅ | `isEligibleForRefund` returns `eligible:false` for `ageDays > 30`; test at `refund.spec.ts:61` asserts `status === 'rejected'`. |
| AC-2 | ✅ | `refundService.ts:27` propagates `'REFUND_WINDOW_EXPIRED'`; test at `refund.spec.ts:73` asserts the exact string. |
| AC-3 | ✅ | `overrideRefund()` sets `status='approved'`, `reasonCode='ADMIN_OVERRIDE'`; test asserts both. |
| AC-4 | ✅ untestable | `testable:false`, `covered:false`. Correct — no SLA given. |
| AC-5 | ✅ | `db.auditLog` push at `refundService.ts:59–64`; test asserts `adminUserId` and `at` fields. |
| AC-6 | ✅ | `daysUntilDeparture >= 7` → `feeCents = 0`; test supplies 10-day departure. |
| AC-7 | ✅ | Two tests: economy 5000, business 15000, both with 3-day departure. |
| AC-8 | ✅ | Test at `flight-change.spec.ts:79` uses `requestedAt = 23:45 UTC`, departure exactly +7 days (millisecond-exact) — no wall-clock or `getRequestNow()` involvement. |

**Finding C-1 — LOW — AC-1 test only covers 31-day boundary; exact 30-day boundary untested**
`file: hackathon-specific/sample-project/tests/refund.spec.ts:61`
The test uses `daysAgo(31)`. AC-1 says "within 30 days". There is no test confirming a booking purchased exactly 30 days ago is still approved (boundary condition `ageDays === 30` — with `> 30` logic, it should pass). Not a blocking issue but the fenceline is unexercised.
*Suggested fix:* Add a test: `purchasedAt: daysAgo(30)` → `refund.status === 'approved'`. One extra test case in `refund.spec.ts`.

**Finding C-2 — LOW — AC-3 test does not verify the booking's status becomes `'refunded'` after override**
`file: hackathon-specific/sample-project/tests/refund.spec.ts:85`
The `overrideRefund` implementation sets `booking.status = 'refunded'` at `refundService.ts:58`. The AC-3 test asserts the `refund` object fields but never reads back the `booking`. A regression in that line would go undetected.
*Suggested fix:* Add `assert.equal(booking.status, 'refunded')` after the `overrideRefund` call, using the booking reference already in scope.

---

## Pass 3 — Gotchas

Checking implementation against `gotchas.md` (gotcha-001) and the architecture sharp-edges table.

**gotcha-001 — `getRequestNow()` local-time + literal "Z"**
- `validators.ts`: `getRequestNow` import removed; `Date.now()` used. ✅ Fix applied.
- `bookingService.ts`: `getRequestNow` never imported; `Date.now()` / `requestedAt` used. ✅ Clean.
- `refundService.ts`: `new Date().toISOString()` used for `requestedAt`, `decidedAt`, `at` fields (display/storage, not arithmetic). ✅ Correct usage — these are display/record timestamps, not fed into elapsed-time arithmetic.
- `requestContext.ts`: Still broken by design (demo artifact). Not touched. ✅ Per-spec.

**Finding G-1 — INFO — `requestContext.ts:9` comment in source does not warn future authors**
`file: hackathon-specific/sample-project/src/lib/requestContext.ts:7`
The function still carries its original comment ("display-only") but the source file has no inline warning about the known bug for future authors who might copy the pattern.
*Suggested fix:* Add a one-line comment: `// WARNING: uses local time components + literal "Z" — display-only, never use in arithmetic`. INFO severity — gotcha-001 exists in the knowledge base; this is defensive belt-and-suspenders only.

---

## Pass 4 — Project conventions

Checking module system, import style, TypeScript strictness, code style, and CLI field ownership.

**Finding V-1 — LOW — `adminOverride.ts:4` comment is now stale**
`file: hackathon-specific/sample-project/src/refunds/adminOverride.ts:4`
The comment reads `// Not called anywhere yet - added ahead of the admin-override refund flow that's still on the roadmap`. `overrideRefund()` now calls `canOverrideRefund()` directly, so this is false.
*Suggested fix:* Remove or rewrite to: `// Called by overrideRefund() in refundService.ts`.

**Finding V-2 — LOW — Mixed quote style between files**
`bookingService.ts` uses single quotes throughout; `refundService.ts`, `validators.ts`, `db.ts`, and the test files use double quotes. The pre-existing files used double quotes; `bookingService.ts` (written in this task) uses single.
`file: hackathon-specific/sample-project/src/bookings/bookingService.ts:1`
The project has no linter/formatter config, so this is convention-by-example. New files should match the dominant style (double quotes).
*Suggested fix:* Convert `bookingService.ts` string literals to double quotes to match `refundService.ts`, `db.ts`, etc. (cosmetic; no functional impact).

**Finding V-3 — INFO — `changeBooking` not exposed via any HTTP route**
`file: hackathon-specific/sample-project/src/routes/bookings.routes.ts`
`changeBooking` is implemented and tested at the service layer but is not wired into any route. This is consistent with `overrideRefund` (AC-3/5) having no route either — the demo project tests the service layer directly. The ACs say nothing about HTTP endpoints for these features, so this is not a spec gap. However it is a notable completeness gap for the demo.
*Suggested fix:* Out of scope for this task. Flag for a follow-up ticket if HTTP surface is required.

**Finding V-4 — INFO — `task.json.currentStage` shows `"test"` not `"review"`**
`file: .relay/tasks/T-000-mariam/task.json:13`
The `currentStage` field still reads `"test"` (the CLI advances it on `stage start`/`stage end` — this will self-correct when `relay stage end review` runs). No action needed.

**Conventions confirmed ✅:**
- All new local imports use `.js` extensions (`bookingService.ts:1–6`, `refundService.ts:1–7`, `db.ts:4`). NodeNext module rules respected.
- `db.ts:83` uses `export let db` — consistent with pre-existing pattern.
- `emptyStore()` used in `resetDb()` — `auditLog: []` initialised correctly.
- No `writeFile`/`atomicWrite` concerns (sample project; not the CLI).
- TypeScript strict mode: `AuditEvent.type` is `string` (not a union) — permissive but matches the pre-existing `RefundRequest.reasonCode: string | null` pattern.

---

## Summary

| ID | Severity | Pass | File:line | One-line description |
|----|----------|------|-----------|----------------------|
| P-1 | LOW | Plan | `refundService.ts:49` | `overrideRefund` allows re-approving already-approved/pending refunds |
| P-2 | LOW | Plan | `bookingService.ts:47` | `changeBooking` allows no-op same-flight change, creates spurious payment |
| C-1 | LOW | Criteria | `refund.spec.ts:61` | AC-1 boundary at exactly 30 days untested |
| C-2 | LOW | Criteria | `refund.spec.ts:85` | AC-3 test doesn't assert booking status becomes `'refunded'` |
| G-1 | INFO | Gotchas | `requestContext.ts:7` | No inline warning on the known-broken `getRequestNow()` for future authors |
| V-1 | LOW | Conventions | `adminOverride.ts:4` | Stale "not called anywhere yet" comment |
| V-2 | LOW | Conventions | `bookingService.ts:1` | Single quotes diverge from project double-quote convention |
| V-3 | INFO | Conventions | `bookings.routes.ts` | `changeBooking` has no HTTP route (out of scope; flag for follow-up) |
| V-4 | INFO | Conventions | `task.json:13` | `currentStage` stale — self-corrects on `stage end review` |

**No blockers. All ACs covered (except the untestable AC-4). Implementation matches the plan.**
