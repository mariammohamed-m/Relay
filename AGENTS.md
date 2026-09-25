# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## What this repo is

Relay is not a standalone app. It is three things sharing one data contract:

1. **`.bob/`** — Bob IDE configuration (custom modes, rules, skills) that make Bob read/write structured context files at every dev-workflow stage.
2. **`cli/`** — TypeScript CLI (`@relay/cli`) scaffolding and managing `.relay/` files.
3. **`dashboard/`** — Static React/Vite app that reads one compiled JSON file (`dashboard/public/relay-data.json`), no server.

## Commands

```bash
# From repo root (npm workspaces: cli, dashboard)
npm install
npm run build           # tsc for cli, tsc+vite for dashboard

# CLI (from cli/):
npm run build           # tsc -p tsconfig.json → dist/
npm run test            # tsc + node --test dist/*.test.js  (no vitest — uses node:test)
npm run dev             # tsc --watch

# Dashboard (from dashboard/):
npm run dev             # vite dev server
npm run build           # tsc + vite build

# Relay CLI (after npm install or via npx):
npx relay init
npx relay task new "<title>"
npx relay stage start <stage>
npx relay stage end <stage>
npx relay compile                    # writes dashboard/public/relay-data.json
npx relay status
npx relay doctor
```

**No lint setup exists yet** — don't invent lint commands.

**Run a single test:** There is no test-name filter in the current `npm run test` script. To isolate a test, temporarily comment out others in `cli/src/cli.test.ts`.

## Architecture — load-bearing facts

- **`cli/src/types.ts` is the single source of truth** for all data shapes. `dashboard/src/lib/types.ts` re-exports from it via `export * from '../../../cli/src/types'` — never duplicate or define shapes there.
- **`STAGES` const array** (`onboard,brief,plan,implement,debug,test,review,pr,docs`) is the canonical stage order. Iterate over it; never hardcode the list elsewhere. `StageId` is derived from it.
- **The dashboard is a dumb reader** — it reads only the compiled `relay-data.json` snapshot, never raw `.relay/` files. Stage artifact Markdown and subagent lanes are embedded into `StageRecord.content` / `StageRecord.subagents` at compile time.
- **`.relay/` and `.bob/` are NOT gitignored** — they are the product.
- **`fs.watch` recursive** only works on win32/darwin. If Linux support is needed, add chokidar (see `compile.ts` comment).

## Relay workflow rules (applies every stage)

1. Read `.relay/.active` to get the active task id. Never hardcode it. Run `npx relay status` if in doubt.
2. Before touching any file, read `.relay/knowledge/` (`gotchas.md`, `architecture.md`, `decisions.md`, `glossary.md`).
3. Every stage: `npx relay stage start <stage>` → do work → write artifact → `npx relay stage end <stage>` → `npx relay compile`. On CLI failure: report and continue — never abort the stage.
4. Each stage owns exactly one artifact file (see table below). Never write another stage's file.
5. Write only `task.json` fields your stage owns — the CLI owns `stages.*`; never edit it directly.

## Stage → artifact mapping

| Stage     | File                   | task.json fields owned        |
| --------- | ---------------------- | ----------------------------- |
| onboard   | *(none)*               | —                             |
| brief     | `01-brief.md`          | `acceptanceCriteria`          |
| plan      | `02-plan.md`           | —                             |
| implement | `03-implementation.md` | `filesTouched`                |
| debug     | `04-debug-notes.md`    | `knowledgeHarvested` (via CLI)|
| test      | `05-tests.md`          | `acceptanceCriteria[].covered`/`.testRef` (via `relay criteria cover`) |
| review    | `06-review.md`         | —                             |
| pr        | `07-pr.md`             | —                             |
| docs      | *(none)*               | —                             |

## Critical gotchas

- **`AcceptanceCriterion.covered`** must only be `true` when a real test verifies it. An honest amber (`testable:true, covered:false`) is a product requirement — never mark something covered just because it was implemented.
- **`atomicWrite`** (in `cli/src/fsutil.ts`) is mandatory for all file writes in the CLI — it uses a temp-file + rename to prevent corruption. Never use `writeFile` directly for task.json.
- **`gotchas.md` entries** use a strict format that `knowledge.ts`'s `parseGotchas` requires: `## gotcha-NNN - Title` heading, then `- **field:** value` bullets in exact order. Off-format entries silently fail to compile into `relay-data.json`. Activate the `relay-harvest` skill for the exact template.
- **paths.ts exports functions, not constants** — all `.relay/` paths are computed from `process.cwd()` at call time. Tests `chdir` into a scratch temp dir per test; anything that caches a path at import time will break tests.
- **`cli/` uses `"module": "NodeNext"`** — all local imports must use `.js` extensions, even for `.ts` source files (e.g. `import { foo } from './fsutil.js'`).
- **`getRequestNow()` in `sample-project/src/lib/requestContext.ts` is display-only** — it uses local date components + literal `"Z"`, producing wrong UTC on non-UTC hosts. Never feed its output into `Date` constructors or arithmetic. Use `Date.now()` or `new Date().toISOString()` for elapsed-time work. See gotcha-001.

## Sample project — Meridian Travel Backend (T-000)

`hackathon-specific/sample-project/` is an Express 5 / TypeScript / `node:test` demo project used to drive the first Relay task (T-000-mariam). It is **not gitignored**. Key rules:

- All service-layer tests call `seedAll()` in `beforeEach` to reset in-memory state.
- `changeBooking()` and `overrideRefund()` are implemented at the service layer but have **no HTTP routes** — tests invoke them directly. This is intentional for the demo.
- New service files should match the existing double-quote style (`refundService.ts`, `db.ts`); `bookingService.ts` uses single quotes — a known divergence (review finding V-2, T-000).
- `MANUAL_REVIEW_AGE_DAYS = 90` branch in `validators.ts` is intentionally unreachable given `REFUND_WINDOW_DAYS = 30`; kept for future-proofing.
- `tests/refund-window.boundary.spec.ts` is excluded from `npm test` (run via `npm run test:planted-bug`); it asserts the broken pre-fix behaviour as a permanent demo artifact.

## Code style

- TypeScript strict mode, ESM (`"type":"module"`), Node 20+, npm workspaces.
- No linter config exists — follow existing patterns (2-space indent, single quotes, trailing commas in multi-line).
- Any placeholder file should carry `// Placeholder — Sprint N` headers matching the existing files.
- `dashboard/src/lib/types.ts` must stay a pure re-export — never a fork.
