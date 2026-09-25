# Demo answer key

**This file is `.bobignore`d - Bob must never read it.** It exists so a human
running or rehearsing the demo can verify a live run landed on the right
answer, or recover if it goes sideways. If you're Bob, or reading this
through Bob's context, stop here.

## The planted bug

**Location:** `sample-project/src/lib/requestContext.ts:7` (`getRequestNow`),
consumed by `sample-project/src/refunds/validators.ts:9`
(`getPurchaseAgeDays`).

**What it looks like:** `getRequestNow()` builds a timestamp string from the
current moment's _local_ date/time components (`getFullYear`, `getMonth`,
`getDate`, `getHours`, `getMinutes`, `getSeconds`) and appends a literal
`"Z"` - so it _looks_ like a normal UTC ISO timestamp (`2026-10-01T02:30:00Z`)
but the digits are actually local wall-clock time, not UTC. Nothing about the
function's name, its call sites, or its comments hints at this - it reads as
an ordinary "give me a timestamp for this log line" helper, because for its
two existing call sites (an invoice line, an audit log) that's exactly what
it safely is: display-only, never parsed back into a `Date`.

**Why it fails:** `getPurchaseAgeDays()` does `new Date(getRequestNow())` to
get "now" for a date-math comparison. Because the string ends in `Z`,
`Date`'s parser treats it as UTC - silently reinterpreting local wall-clock
digits as if they were UTC digits. In a UTC+2 zone this adds two real hours
to every computed "now," which is small enough to be invisible almost all of
the time, and large enough to flip a booking across a day-level threshold
when the true age sits close to one.

**Deterministic reproduction:** `sample-project/tests/refund-window.boundary.spec.ts`,
run via `npm run test:planted-bug` (not part of `npm test`). It fixes the
clock to `2026-10-01T00:30:00Z` (via `node:test`'s mock timers) and fixes
`TZ=Etc/GMT-2` (a static UTC+2 offset with no DST - chosen over a named zone
like Africa/Cairo, the brief's example, specifically so the result can't
drift if two machines have different bundled tzdata versions). A booking
purchased exactly "90 days + 23h" before that instant is truly 90 days old
(not flagged, since the manual-review rule is `> 90`), but the bug computes
91 days and flags it. Confirmed identical across repeated runs - see the
build's own verification output.

**Why this bug, not a more obvious one:** it's realistic. "Build an
ISO-looking string with a trailing Z from local getters" is a genuine,
common real-world mistake (it happens whenever someone hand-rolls a
timestamp instead of calling `toISOString()`), it passes every existing
test (none of them cross a local-midnight-adjacent boundary), and it hides
in a function whose _existing, legitimate_ uses are entirely safe - which is
exactly the disguise a real shared-utility trap wears.

## Expected fix

Add a UTC-safe variant - e.g. `getRequestNowUtc()` returning `Date.now()` or
`new Date().toISOString()` directly, no local-getter round-trip - and switch
`getPurchaseAgeDays()` (and anything else doing date _math_, as opposed to
date _display_) to use it. Leave `getRequestNow()` itself in place: its
existing display-only call sites (`src/payments/invoices.ts`) are not bugs,
and "fixing" the helper in place would just relocate the trap.

The refund-window feature Bob builds during `implement` (extending
`isEligibleForRefund` / adding `isWithinRefundWindow`-style logic per
`02-plan.md`'s pattern) will reach for whatever "get now" helper it finds -
`getRequestNow()` is the only one in the codebase, which is precisely the
mechanism that surfaces the bug during `test`/`debug` without anyone having
had to write broken code on purpose in the moment.

## Expected knowledge-base entry

A live run's `debug` stage should harvest something with this shape (ids
allocated at harvest time - don't expect it to literally be `gotcha-014`
unless the knowledge base is empty when the run starts, which `demo-reset`
guarantees):

```
title: getRequestNow() returns a local-time string, not UTC
discoveredIn: <the live task id>
symptom: a boundary test near a UTC+2 local midnight failed unexpectedly -
  a booking correctly 90 days old was flagged as 91.
rootCause: getRequestNow() (src/lib/requestContext.ts) builds a
  local-wall-clock string with a trailing "Z"; new Date(getRequestNow())
  in getPurchaseAgeDays() (src/refunds/validators.ts) parses it as UTC,
  silently adding the local UTC offset to every computed "now".
fix: added getRequestNowUtc(); switched date-math call sites to it;
  left getRequestNow() for its existing display-only uses.
watchOut: grep for getRequestNow() (not *Utc) before adding new date math -
  every existing call site is a display use.
codeRefs: [src/lib/requestContext.ts:7, src/refunds/validators.ts:9]
```

This is intentionally the same shape as the mock `gotcha-014` entry in
`.relay/knowledge/gotchas.md` (see `docs/demo-script.md` for why the mock
and the live knowledge base are deliberately two separate things).

## Expected extracted criteria

Generated by `scripts/make-ticket` from `scripts/make-ticket/tickets/*.json`
into `sample-project/docs/tickets/*.pdf` - read the JSON source for the
exact wording; this section is the extraction checklist.

### REF-88 - "Enforce 30-day refund window on booking cancellations"

Four bullets in the ticket's own **Acceptance Criteria** section:

1. **AC-1 (testable - window enforcement):** refund requests are only
   approved within 30 days of purchase.
2. **AC-2 (testable - rejection reason code):** a rejection outside the
   window must return a machine-readable reason code
   (e.g. `REFUND_WINDOW_EXPIRED`).
3. **AC-3 (testable - admin override):** admins can override a rejected
   refund and force-approve it.
4. **AC-4 (deliberately vague):** "Refunds should be processed promptly."
   No measurable bound. Expected flagged rewrite: something equivalent to
   _"Refund approval or rejection decisions are communicated to the
   requester within 2 business days of the request."_

**Plus one requirement that appears only in a comment, not the AC list:**
Marcus Webb's (Finance) second comment requires that an admin override be
logged as an audit event with the admin's user id and a timestamp. This is
a genuine addition to AC-3's scope, not a restatement of it - a brief stage
that only reads the Description/Acceptance-Criteria sections and skips the
comments will miss it. Expect a competent extraction to either add a 5th
criterion for the audit-log requirement or explicitly fold it into AC-3's
recorded scope; either is acceptable, silently dropping it is not.

### REF-91 - "Apply a flight-change fee within 7 days of departure"

Three criteria (no-fee outside 7 days, fee within 7 days, timezone-consistent
boundary) plus a comment from Priya Anand (Support) that explicitly points
back at REF-88's timezone issue. **This is the flywheel check:** this
ticket's `brief` stage should surface the harvested knowledge-base entry
above (whatever id it was harvested as) as relevant _before any code is
written_ for REF-91, because it touches the same date-math seam (a
day-boundary check relative to "now"). If a live run's `01-brief.md`-
equivalent output does not mention it, that's a real miss to flag, not an
acceptable variation.

1. A flight change requested more than 7 days before departure incurs no fee.
2. A flight change requested within 7 days of departure incurs the
   configured change fee.
3. The 7-day boundary must be computed the same way regardless of the
   requester's timezone - the same class of risk as REF-88, which is the
   point.
