# Architecture — Relay

Short orientation for `onboard`. Three packages share one data contract.

---

## 1. Overview

Relay is not a standalone app. It is three things sharing a single data contract:

- **`cli/`** — TypeScript CLI (`@relay/cli`) that scaffolds and manages `.relay/` baton files.
- **`dashboard/`** — Static React/Vite app that reads one compiled JSON file (`dashboard/public/relay-data.json`), no server.
- **`.bob/`** — Bob IDE configuration (custom modes, rules, skills) that drives structured agent behavior at every dev-workflow stage.

The `.relay/` directory (tasks, knowledge, metrics) is the shared runtime data store. It is **not gitignored** — it is the product.

**Active task:** T-000 (refund-window) — completed. See `tasks/T-000-mariam/`.

---

## 2. CLI (`cli/`)

### What it does

Manages the `.relay/` baton: task lifecycle (init, stage start/end, criteria, harvest), telemetry (events.jsonl), and compilation into the dashboard snapshot.

### Key source files

| File | Purpose |
|------|---------|
| `types.ts` | **Single source of truth** for all data shapes. `dashboard/src/lib/types.ts` re-exports from here — never duplicate. |
| `index.ts` | CLI entrypoint; Commander dispatch to command modules. |
| `scaffold.ts` | `relay init` / `relay task new` / `relay task use` — creates `.relay/` structure and task dirs. |
| `stage.ts` | `relay stage start|end|skip` — stage lifecycle and timing in `task.json`. |
| `compile.ts` | `relay compile` — aggregates all tasks/events/knowledge into `dashboard/public/relay-data.json`. Embeds artifact Markdown into `StageRecord.content` and subagent lanes into `StageRecord.subagents`. |
| `criteria.ts` | `relay criteria list|cover|uncover` — acceptance criterion coverage state. |
| `harvest.ts` | `relay harvest <id>` — records knowledge entry use on a task. |
| `knowledge.ts` | Tolerant Markdown parser for `gotchas.md` → `KnowledgeEntry[]`. Missing fields become null (no error). Typos in field names silently skip that field. |
| `events.ts` | Append-only JSONL writer/reader for `metrics/events.jsonl`. Malformed lines skipped with `console.warn` — metrics incomplete but won't crash. |
| `paths.ts` | **Functions, not constants** — all `.relay/` paths computed from `cwd()` at call time. Tests `chdir` per test; cached paths at import time will break. |
| `fsutil.ts` | `atomicWrite` (temp + rename) is mandatory for all file writes — never use `writeFile` directly for `task.json`. |
| `active.ts` | Resolves active task: `--task` flag → `.active` file → most-recently-modified `task.json`. |
| `stageArtifact.ts` | Fixed stage→artifact filename mapping (source of truth for baton filenames). |
| `status.ts` / `doctor.ts` / `report.ts` | Status summary, config sanity-check, baseline-vs-relay comparison. |

### Data contract

**STAGES** const array drives `StageId` — iterate it, never hardcode the list. Current order: `onboard, brief, plan, implement, debug, test, review, pr, docs`.

Key `types.ts` shapes:
- **`Task`** — root record: id, slug, title, source, mode (relay|baseline), currentStage, stages dict, acceptanceCriteria[], knowledgeHarvested[], filesTouched[].
- **`StageRecord`** — status, artifact path, timing, optional `content` (embedded text), optional `subagents[]`.
- **`AcceptanceCriterion`** — id, text, testable, covered (**must only be `true` when a real test verifies it**), testRef, ambiguityNote.
- **`KnowledgeEntry`** — gotcha record parsed from `gotchas.md`.
- **`RelayData`** — compiled snapshot: schemaVersion, generatedAt, tasks[], knowledge[], impact.

### Build/test

```bash
# From cli/:
npm run build   # tsc → dist/
npm run test    # tsc + node --test dist/*.test.js (node:test, no vitest)
npm run dev     # tsc --watch
```

Module system: `"type": "module"`, `"module": "NodeNext"` — all local imports need `.js` extensions on `.ts` source files.

### Sharp edges
- `paths.ts` uses functions not constants (see above — gotcha-safe).
- `atomicWrite` in `fsutil.ts` is mandatory; may leave `.tmp-<pid>` orphans on crash.
- Events.jsonl drops malformed lines silently.
- Stage can't go backward; `stage end` before `stage start` creates a 0-second stage — no guard.
- `task.mode` defaults to `"relay"` — `--baseline` flag must be explicit for manual baseline runs.
- No schema migration logic; `SCHEMA_VERSION=1` mismatch halts dashboard render.

---

## 3. Dashboard (`dashboard/`)

### What it does

A static React/Vite SPA that polls `relay-data.json` every 2s and visualises task pipelines, acceptance criteria coverage, performance impact, and knowledge harvesting. No server — the compiled JSON snapshot is the only data source.

### Data flow

```
dashboard/public/relay-data.json  (written by relay compile)
         ↓
useRelayData (2s polling, stale-while-revalidate)
         ↓
fetchRelayData / validate.ts  (4 failure modes: missing/unreachable/malformed/schema-mismatch)
         ↓
RelayApp  →  per-task panels + JourneyRail
```

Vite dev server returns `index.html` (200) for missing static files; validator sniffs `Content-Type` + doctype to treat this as "missing" — prevents false malformed-JSON errors in dev.

### Key source files

| File | Purpose |
|------|---------|
| `lib/types.ts` | Pure re-export from `../../../cli/src/types` — **never fork this file**. |
| `RelayApp.tsx` | Data loader, active task state, failure/empty/success rendering. |
| `useRelayData.ts` | Polling fetch hook (2s, React Query). |
| `validate.ts` | Typed failure detection for relay-data.json fetch. |
| `JourneyRail.tsx` | Hero 9-stage pipeline with status glyphs and modal artifact viewer. |
| `CriteriaCoverage.tsx` | 3-state criteria UI: covered / uncovered (neutral, not red) / untestable (amber). |
| `ImpactPanel.tsx` | Baseline-vs-relay bar charts per stage; silently omits stages with no baseline data. |
| `KnowledgeFeed.tsx` | Gotchas feed, newest-first, pulsing accent on harvested entries. |
| `BatonPanel.tsx` | Audit panel: artifacts, criteria count, knowledge available-at-onboarding vs harvested-this-task. |
| `ParallelLanes.tsx` | Subagent concurrency timeline; returns `null` (no layout space) when no subagents exist. |
| `AppBar.tsx` | Header with task switcher dropdown and live status badge. |

### Sharp edges
- No component memoization — all panels re-render every 2s. Acceptable for demos; add `React.memo` for prod.
- `dashboard/src/lib/types.ts` must remain a pure re-export — the architecture depends on one source of truth.
- `ImpactPanel` silently drops stages where `baselineSec === null`.
- `CriteriaCoverage` renders uncovered criteria as **neutral gray by design** — uncovered is an honest state, not an error.

---

## 4. Bob Configuration (`.bob/`)

### Custom modes

Seven modes map to Relay pipeline stages. Each loads stage-specific rules from `.bob/rules-<slug>/`.

| Mode slug | Stage | Edit scope |
|-----------|-------|------------|
| `relay-onboard` | onboard | `.relay/knowledge/*`, `AGENTS.md` only |
| `relay-brief` | brief | `.relay/tasks/*` only |
| `relay-debug` | debug | unrestricted edit |
| `relay-test` | test | unrestricted edit |
| `relay-review` | review | `.relay/tasks/*` only |
| `relay-pr` | pr | `.relay/tasks/*` only |
| `relay-docs` | docs | `.relay/*`, `AGENTS.md`, `docs/*` |

Built-in Plan and Agent modes are customized via `.bob/rules-plan/` and `.bob/rules-agent/` — Relay conventions apply to every use in this workspace.

### Skills

| Skill | When activated |
|-------|---------------|
| `relay-baton` | Stage→artifact mapping, CLI commands, task.json field ownership |
| `relay-criteria` | Acceptance criteria extraction and testability rules |
| `relay-harvest` | Exact `gotchas.md` entry format required by the parser (see gotcha-safe format below) |

### Gotcha entry format (required by `knowledge.ts` parser)

```markdown
## gotcha-NNN - Title

- **discoveredIn:** T-NNN-slug
- **discoveredAt:** ISO-8601Z
- **costMinutes:** N
- **symptom:** ...
- **rootCause:** ...
- **fix:** ...
- **watchOut:** ...
- **codeRefs:** path:line
- **stalenessCheck:** ...
```

Fields must appear in this order. Off-format entries silently fail to compile into `relay-data.json` (activate `relay-harvest` skill for the exact template).

---

## 5. `.relay/` Directory Layout

```
.relay/
├── .active                # Current task ID
├── config.yml             # Project config
├── knowledge/
│   ├── architecture.md    # ← this file
│   ├── decisions.md       # Cross-task architectural decisions
│   ├── glossary.md        # Term definitions
│   └── gotchas.md         # KnowledgeEntry records
├── metrics/
│   └── events.jsonl       # Append-only task telemetry
└── tasks/
    └── T-NNN-<slug>/
        ├── task.json
        ├── 01-brief.md
        ├── 02-plan.md
        ├── 03-implementation.md
        ├── 04-debug-notes.md
        ├── 05-tests.md
        ├── 06-review.md
        └── 07-pr.md
```

---

## 6. Sample Project — Meridian Travel Backend

**Active working copy: `hackathon-specific/sample-project/`** — use this path for all onboard, brief, implement, and test work. (`sample-project/` at the repo root is the original demo reference copy; do not edit it.)

The sample project is a **Node.js/Express 5 REST API** (TypeScript, ES2022, NodeNext modules) for a fictional travel booking service. It runs entirely in-memory — no real database.

### Runtime & stack

| Concern | Choice |
|---------|--------|
| Framework | Express 5.2.1 |
| Language | TypeScript 5.6, strict mode |
| Module system | ESM (`"type":"module"`, `"module":"NodeNext"`) — `.js` extensions on all local imports |
| Persistence | In-memory `Map<string, T>` store in `src/lib/db.ts` — **not production-safe** |
| Entry point | `src/index.ts` → port 4000 (or `PORT` env) |
| Test runner | `node:test` via `scripts/run-tests.mjs`; boundary-bug test in `scripts/run-boundary-test.mjs` |

### Directory map

```
hackathon-specific/sample-project/src/
├── index.ts               # Boot: seedAll() → createApp() → listen(4000)
├── server.ts              # Express wiring, routers, centralised error handler
├── seed.ts                # seedAll(): resetDb → seedUsers → seedFlights → seedBookings
├── auth/
│   ├── users.ts           # seedUsers(), getUser(), findUser(), 3 demo users
│   └── permissions.ts     # hasPermission(user, perm) — array membership only
├── bookings/
│   ├── bookings.ts        # getBooking(), listBookingsForUser()
│   ├── bookingService.ts  # createBooking(), cancelBooking(), changeBooking(), seedBookings() ← changeBooking added T-000
│   └── flights.ts         # getFlight(), listFlights(), seedFlights(), 3 demo routes
├── payments/
│   ├── paymentService.ts  # chargeBooking(), getPaymentForBooking()
│   └── invoices.ts        # formatInvoiceLine() — audit log text using getRequestNow()
├── lib/
│   ├── db.ts              # Types + global `db` Store + resetDb(); AuditEvent + auditLog[] added T-000
│   ├── errors.ts          # AppError, NotFoundError (404), ValidationError (422), ForbiddenError (403)
│   ├── ids.ts             # nextId(prefix), resetIds() — sequential prefixed IDs, not prod-safe
│   └── requestContext.ts  # getRequestNow() ← PLANTED BUG: local time + literal "Z" = wrong UTC
├── refunds/
│   ├── validators.ts      # isEligibleForRefund(), getPurchaseAgeDays() ← bug propagates here
│   ├── refundService.ts   # requestRefund(), getRefundRequest(), overrideRefund() ← overrideRefund added T-000
│   └── adminOverride.ts   # canOverrideRefund() — called by overrideRefund() (wired in T-000)
└── routes/
    ├── auth.routes.ts     # GET /users/:id
    ├── bookings.routes.ts # GET /flights, POST /bookings, GET /bookings/:id, GET /users/:userId/bookings
    ├── payments.routes.ts # POST /bookings/:id/payment, GET /bookings/:id/invoice
    └── refunds.routes.ts  # POST /bookings/:id/refund, GET /refunds/:id
```

### Key data shapes (from `src/lib/db.ts`)

```
User           id, name, email, role("customer"|"admin"), permissions: string[]
Flight         id, origin, destination, departsAt(ISO8601 UTC), basePriceCents
Booking        id, userId, flightId, seatClass("economy"|"business"), status, purchasedAt(ISO8601 UTC), priceCents
Payment        id, bookingId, amountCents, method("card"|"wallet"), paidAt
RefundRequest  id, bookingId, requestedAt, status("pending"|"approved"|"rejected"),
               reasonCode, decidedAt, overriddenByUserId
AuditEvent     type, refundId, adminUserId, at  ← added T-000; stored in db.auditLog[]
```

### Demo seed data

| Entity | id | Detail |
|--------|----|--------|
| User | `user-cust-01` | Jordan Reyes, customer, no permissions |
| User | `user-cust-02` | Priya Nandakumar, customer, no permissions |
| User | `user-admin-01` | Sam Okafor, admin, `["refunds:override","bookings:manage"]` |
| Flight | `flight-101` | JFK→LHR, $540 |
| Flight | `flight-102` | LHR→CDG, $120 |
| Flight | `flight-103` | SFO→NRT, $890 |
| Booking | `bkg-0001` | user-cust-01, flight-101, economy, purchased 2026-08-10 |
| Booking | `bkg-0002` | user-cust-02, flight-103, business, purchased 2026-09-01 |

### API surface

| Method | Path | Notes |
|--------|------|-------|
| GET | `/health` | `{ok:true}` |
| GET | `/users/:id` | |
| GET | `/flights` | |
| POST | `/bookings` | body: `{userId, flightId, seatClass}` |
| GET | `/bookings/:id` | |
| GET | `/users/:userId/bookings` | |
| POST | `/bookings/:id/payment` | body: `{amountCents, method?}` |
| GET | `/bookings/:id/invoice` | returns `text/plain` |
| POST | `/bookings/:id/refund` | |
| GET | `/refunds/:id` | |

No auth middleware on any route.

### Refund eligibility logic

[`isEligibleForRefund()`](hackathon-specific/sample-project/src/refunds/validators.ts:22) in `validators.ts`:
1. Booking must be `"confirmed"` — else `eligible: false, NOT_ELIGIBLE`
2. Calls [`getPurchaseAgeDays()`](hackathon-specific/sample-project/src/refunds/validators.ts:7) which calls `getRequestNow()` for "now" — **this is where the planted bug enters**
3. If `ageDays > 90` → `eligible: true, needsManualReview: true` (blunt instrument — TODO on line 19)
4. Otherwise → `eligible: true, needsManualReview: false`

### The planted bug — `getRequestNow()` in `src/lib/requestContext.ts:7`

`getRequestNow()` assembles an ISO timestamp from **local** date components (`d.getHours()` etc.) then appends a literal `"Z"`. On a non-UTC server this produces a timestamp that claims to be UTC but contains local wall-clock numbers — up to ±14h wrong.

`getPurchaseAgeDays()` parses this string back with `new Date(getRequestNow()).getTime()`, so the millisecond arithmetic for "now" inherits the offset. In a UTC+2 zone the computed age is 2 hours longer than reality, enough to flip a booking from 90 days to 91 days near midnight.

**Rule:** never use `getRequestNow()` in any comparison or arithmetic. Use `new Date().toISOString()` or `Date.now()` directly. `getRequestNow()` is display-only (invoice timestamps etc.).

The regression test `tests/refund-window.boundary.spec.ts` documents this with a mocked clock and `TZ=Etc/GMT-2`. Run via `npm run test:planted-bug`, not `npm test`.

### Build & test

```bash
cd hackathon-specific/sample-project
npm install
npm run build                  # tsc → dist/
npm start                      # node dist/index.js (port 4000)
npm test                       # build + all *.spec.js except boundary
npm run test:planted-bug       # build + boundary spec only, TZ=Etc/GMT-2
```

### Module system rules for this project

- `"type":"module"` + `"module":"NodeNext"` — every local import needs `.js` extension.
- Tests use `node:test` + `node:assert/strict`. Each spec calls `seedAll()` in `beforeEach` to reset state.
- No Vitest, no Jest.

---

## 7. Known Sharp Edges

| Issue | Location | Impact |
|-------|----------|--------|
| `getRequestNow()` uses local time + literal "Z" | `src/lib/requestContext.ts:7` | All date math fed through it is wrong on non-UTC servers — use `Date.now()` or `new Date().toISOString()` |
| `getPurchaseAgeDays()` uses `getRequestNow()` for "now" | `src/refunds/validators.ts:9` | Refund age computation wrong on non-UTC servers |
| No auth middleware | `src/routes/*.routes.ts` | Every endpoint is unauthenticated |
| `db` is a mutable exported singleton | `src/lib/db.ts:74` | Direct mutations, no transactions — tests must call `seedAll()` to reset |
| `canOverrideRefund()` is dead code | `src/refunds/adminOverride.ts:6` | Admin override flow not wired anywhere |
| `nextId` / `resetIds` are not persistent | `src/lib/ids.ts` | IDs reset on restart — not production-safe |
| `boundary.spec.ts` excluded from `npm test` | `scripts/run-tests.mjs:15` | Main suite is green while bug is live — deliberate for demo |
