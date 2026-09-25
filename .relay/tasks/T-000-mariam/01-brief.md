# 01-brief.md — T-000 mariam

**Criteria extracted:** 8 · **Ambiguous:** 1

Tickets briefed: `REF-88` (refund window enforcement) and `REF-91` (flight-change fee within 7 days of departure).

---

## Acceptance Criteria

| ID   | Source                           | Text                                                                                                                                                                  | Testable | Ambiguity note |
|------|----------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------|----------------|
| AC-1 | REF-88.pdf p1 §Acceptance Criteria bullet 1 | Refund requests are approved only if submitted within 30 days of the original purchase date.                                                                         | ✅ true  | —              |
| AC-2 | REF-88.pdf p1 §Acceptance Criteria bullet 2 | When a refund is rejected because the request falls outside the 30-day window, the response includes the machine-readable reason code `REFUND_WINDOW_EXPIRED`.       | ✅ true  | —              |
| AC-3 | REF-88.pdf p1 §Acceptance Criteria bullet 3 | An admin user can force-approve a rejected refund (override the 30-day window rejection).                                                                            | ✅ true  | —              |
| AC-4 | REF-88.pdf p1 §Acceptance Criteria bullet 4 | Refunds should be processed promptly.                                                                                                                                 | ❌ false | **Vague — no SLA bound.** Ticket provides no timing number. Proposed rewrite (requires stakeholder input): "The `POST /bookings/:id/refund` endpoint responds within X ms at p95 under Y concurrent requests." Request a specific SLA from Elena Cho (Product) or Support before treating this as testable. |
| AC-5 | REF-88.pdf p2 §Comments, Marcus Webb 2026-09-22 | When an admin overrides a rejected refund, an audit event is logged containing the admin's user id and a timestamp.                                                  | ✅ true  | —              |
| AC-6 | REF-91.pdf p1 §Acceptance Criteria bullet 1 | Flight changes requested more than 7 days before scheduled departure incur no change fee.                                                                            | ✅ true  | —              |
| AC-7 | REF-91.pdf p1 §Acceptance Criteria bullet 2 | Flight changes requested within 7 days of scheduled departure incur the standard change fee configured for that fare class.                                          | ✅ true  | —              |
| AC-8 | REF-91.pdf p1 §Acceptance Criteria bullet 3 | The 7-day boundary is computed in UTC regardless of the customer's local timezone.                                                                                   | ✅ true  | —              |

---

## Ambiguity notes

**AC-4 — "Refunds should be processed promptly" (REF-88 p1)**

No SLA bound is given anywhere in the ticket. The criterion has no measurable pass/fail condition as written. Do not implement a threshold — flag to Product (Elena Cho) and ask: what is the required p95 latency and under what load? Until a number is supplied this criterion stays `testable: false` and cannot be covered.

---

## Relevant files

- [`hackathon-specific/sample-project/src/refunds/validators.ts`](hackathon-specific/sample-project/src/refunds/validators.ts) — `isEligibleForRefund()`, `getPurchaseAgeDays()` — where AC-1/AC-2 logic lives and the planted bug propagates
- [`hackathon-specific/sample-project/src/refunds/refundService.ts`](hackathon-specific/sample-project/src/refunds/refundService.ts) — `requestRefund()` — where AC-2 reason code must be returned
- [`hackathon-specific/sample-project/src/refunds/adminOverride.ts`](hackathon-specific/sample-project/src/refunds/adminOverride.ts) — `canOverrideRefund()` — dead code today; must be wired for AC-3/AC-5
- [`hackathon-specific/sample-project/src/lib/requestContext.ts`](hackathon-specific/sample-project/src/lib/requestContext.ts) — `getRequestNow()` — **planted bug**: uses local time + literal "Z"; any date arithmetic via this function is wrong on non-UTC servers. AC-1/AC-8 must NOT use this.
- [`hackathon-specific/sample-project/src/bookings/bookingService.ts`](hackathon-specific/sample-project/src/bookings/bookingService.ts) — `cancelBooking()` — entry point that will need fee-check hook for AC-6/AC-7
- [`hackathon-specific/sample-project/tests/`](hackathon-specific/sample-project/tests/) — test location for all covering tests

---

## Related gotchas

No entries in `gotchas.md` yet, but the architecture notes document the `getRequestNow()` local-time bug directly:

> `getRequestNow()` assembles an ISO timestamp from local date components then appends a literal `"Z"`. On a non-UTC server this is up to ±14 h wrong. **Never use `getRequestNow()` in comparisons or arithmetic** — use `Date.now()` or `new Date().toISOString()` directly. Priya Anand's comment on REF-91 explicitly flags this as the same class of bug seen during REF-88 work.

AC-1 and AC-8 are both at risk if `getRequestNow()` is used for the "now" side of the window calculation.
