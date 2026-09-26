# Onboard — T-000 (mariam)

**Active project:** `hackathon-specific/sample-project` — Meridian Travel Backend  
**Knowledge base read:** `.relay/knowledge/architecture.md`, `gotchas.md`, `decisions.md`

---

## Project overview

Node.js/Express 5 REST API, TypeScript, fully in-memory (no database). Single mutable
`Store` object in `src/lib/db.ts` — five `Map`s, resets on `seedAll()`. Every test
calls `seedAll()` to get a clean fixture.

Port: 4000 (or `$PORT`). Entry: `src/index.ts` → `seedAll()` → `createApp()` → listen.

---

## Subsystem map

### `src/lib/` — core primitives

| File | What it does |
|------|-------------|
| `db.ts` | All domain types + mutable `db` Store + `resetDb()` |
| `errors.ts` | `AppError` / `NotFoundError(404)` / `ValidationError(422)` / `ForbiddenError(403)` — all route errors extend `AppError`; centralised middleware in `server.ts` maps them to HTTP |
| `ids.ts` | `nextId("bkg")` → `"bkg-0001"`, sequential per prefix; `resetIds()` on `resetDb()` |
| `requestContext.ts` | `getRequestNow()` — ⚠️ **PLANTED BUG** (see §Sharp edges) |

### `src/auth/`

- `users.ts` — 3 demo users seeded: `user-cust-01` (Jordan), `user-cust-02` (Priya), `user-admin-01` (Sam, `["refunds:override","bookings:manage"]`)
- `permissions.ts` — `hasPermission(user, perm)` — plain `array.includes`

### `src/bookings/`

- `flights.ts` — 3 demo flights: `flight-101` JFK→LHR $540, `flight-102` LHR→CDG $120, `flight-103` SFO→NRT $890
- `bookings.ts` — `getBooking()`, `listBookingsForUser()`
- `bookingService.ts` — `createBooking()` (economy ×1, business ×2.4 multiplier), `cancelBooking()`

### `src/payments/`

- `paymentService.ts` — `chargeBooking()`, `getPaymentForBooking()`
- `invoices.ts` — `formatInvoiceLine()` — uses `getRequestNow()` for display timestamp (OK for display, not for math)

### `src/refunds/` ← **active task domain**

- `validators.ts` — `isEligibleForRefund()`, `getPurchaseAgeDays()` — **bug propagates here via `getRequestNow()`**
- `refundService.ts` — `requestRefund()` (auto-approve / pending / reject), `getRefundRequest()`
- `adminOverride.ts` — `canOverrideRefund()` — **dead code**, not wired to any route (roadmap)

### `src/routes/` — thin Express handlers, no auth middleware on any route

| Method | Path | Handler |
|--------|------|---------|
| GET | `/health` | `{ok:true}` |
| GET | `/users/:id` | `getUser` |
| GET | `/flights` | `listFlights` |
| POST | `/bookings` | `createBooking` |
| GET | `/bookings/:id` | `getBooking` |
| GET | `/users/:userId/bookings` | `listBookingsForUser` |
| POST | `/bookings/:id/payment` | `chargeBooking` |
| GET | `/bookings/:id/invoice` | `formatInvoiceLine` (text/plain) |
| POST | `/bookings/:id/refund` | `requestRefund` |
| GET | `/refunds/:id` | `getRefundRequest` |

---

## Refund eligibility flow

```
POST /bookings/:id/refund
  → requestRefund(bookingId)
      → isEligibleForRefund(booking)
          → booking.status !== "confirmed"  → rejected / NOT_ELIGIBLE
          → getPurchaseAgeDays(booking.purchasedAt)
              → new Date(getRequestNow()).getTime()  ← BUG ENTERS HERE
          → ageDays > 90  → pending / manual review (TODO: blunt instrument, line 19)
          → ageDays ≤ 90  → approved / AUTO_APPROVED, booking.status = "refunded"
```

---

## ⚠️ Sharp edges

### Planted bug — `getRequestNow()` (`src/lib/requestContext.ts:7`)

Builds an ISO string from **local** date components then appends a literal `"Z"`.
On a non-UTC server the result claims to be UTC but contains local wall-clock
numbers — up to ±14h wrong.

`getPurchaseAgeDays()` passes this through `new Date(…).getTime()` for arithmetic.
In UTC+2 near midnight a booking truly 90 days old is computed as 91 days → wrongly
flagged for manual review.

**Rule:** `getRequestNow()` is display-only. For any date math use `Date.now()` or
`new Date().toISOString()` directly.

Regression test: `tests/refund-window.boundary.spec.ts` — mocked clock + `TZ=Etc/GMT-2`.
Currently **fails**. Excluded from `npm test`; run via `npm run test:planted-bug`.

### Other edges

| Issue | Location |
|-------|----------|
| No auth middleware | `src/routes/*.routes.ts` — all endpoints open |
| `db` is a mutable singleton | `src/lib/db.ts:74` — call `seedAll()` before every test |
| `canOverrideRefund()` not wired | `src/refunds/adminOverride.ts:6` — dead code |
| IDs not persistent | `src/lib/ids.ts` — reset on restart, not prod-safe |
| `boundary.spec.ts` excluded from `npm test` | `scripts/run-tests.mjs:15` — deliberate |

---

## Module system rules

- `"type":"module"` + `"module":"NodeNext"` — every local import needs `.js` extension on `.ts` files
- Tests use `node:test` + `node:assert/strict` — no Vitest, no Jest
- Every test calls `seedAll()` in `beforeEach`

---

## Build & test commands

```bash
cd hackathon-specific/sample-project
npm install
npm run build                  # tsc → dist/
npm start                      # Express on :4000
npm test                       # all *.spec.js except boundary — should pass
npm run test:planted-bug       # boundary spec, TZ=Etc/GMT-2 — currently fails
```

---

## Suggested first task

**REF-88: implement the 30-day refund window.**

Ticket PDF: `hackathon-specific/sample-project/docs/tickets/REF-88.pdf`

Core work: enforce a real 30-day cutoff in `isEligibleForRefund()` (replacing the
blunt 90-day manual-review flag), fix `getRequestNow()` so date arithmetic is
UTC-correct, and make `refund-window.boundary.spec.ts` green.

Switch to **`relay-brief`** mode to start.
