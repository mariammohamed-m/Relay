# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## What this repo is

Relay is not a standalone app. It is two things sharing one data contract:

1. **`.bob/`** - Bob IDE configuration root. Relay owns this folder directly: modes/rules/skills/commands and Relay's own task data (config.yml, knowledge/, tasks/, metrics/) all live at the top level of `.bob/`. `relay init` writes `.bob/` wholesale and overwrites it (or creates it if missing); it refuses to clobber an existing `.bob/` unless run with `--force`.
2. **`cli/`** - TypeScript CLI (`bob-relay`, the published npm package) that scaffolds and manages `.bob/` files, compiles them into a JSON snapshot, and serves a pre-built visual dashboard (`cli/dashboard-dist/`, bundled into the package) that reads that one compiled file, no server beyond the CLI's own static file server.

## Commands

```bash
# From repo root (npm workspace: cli)
npm install
npm run build           # tsc for cli

# CLI (from cli/):
npm run build           # tsc -p tsconfig.json → dist/
npm run test            # tsc + node --test dist/*.test.js  (no vitest - uses node:test)
npm run dev             # tsc --watch

# Relay CLI (after npm install or via npx):
npx relay init
npx relay task new "<title>"
npx relay task estimate         # (re)compute/view the estimated manual-completion baseline
npx relay stage start <stage>
npx relay stage end <stage>
npx relay compile                    # writes the compiled dashboard data file (config.yml's dashboardData path)
npx relay dashboard                  # serves the bundled dashboard against the compiled data
npx relay status
npx relay doctor
```

**No lint setup exists yet** - don't invent lint commands.

**Run a single test:** There is no test-name filter in the current `npm run test` script. To isolate a test, temporarily comment out others in `cli/src/cli.test.ts`.

## Architecture - load-bearing facts

- **`cli/src/types.ts` is the single source of truth** for all data shapes. The bundled dashboard (built from source elsewhere and shipped pre-built in `cli/dashboard-dist/`) reads the same shapes from the compiled JSON snapshot - never duplicate or redefine them.
- **`STAGES` const array** (`onboard,brief,plan,implement,debug,test,review,pr,docs`) is the canonical stage order. Iterate over it; never hardcode the list elsewhere. `StageId` is derived from it.
- **The dashboard is a dumb reader** - it reads only the compiled data snapshot, never raw `.bob/` files. Stage artifact Markdown and subagent lanes are embedded into `StageRecord.content` / `StageRecord.subagents` at compile time.
- **`.bob/` is NOT gitignored** - it is the product. `relay init` overwrites `.bob/` wholesale (or creates it if missing); it refuses to touch an existing `.bob/` unless run with `--force`.
- **`fs.watch` recursive** only works on win32/darwin. If Linux support is needed, add chokidar (see `compile.ts` comment).

## Relay workflow rules (applies every stage)

1. Read `.bob/.active` to get the active task's full folder name (e.g. `T-003-add-foo`, not just `T-003`) and use it as-is under `.bob/tasks/`. Never hardcode it, and never re-derive or truncate it - writing to a path that doesn't match `.active` exactly creates a stray duplicate task folder. Run `npx relay status` if in doubt.
2. Before touching any file, read `.bob/knowledge/` (`gotchas.md`, `architecture.md`, `decisions.md`, `glossary.md`).
3. Every stage: `npx relay stage start <stage>` → do work → write artifact → `npx relay stage end <stage>` → `npx relay compile`. On CLI failure: report and continue - never abort the stage.
4. Each stage owns exactly one artifact file (see table below). Never write another stage's file.
5. Write only `task.json` fields your stage owns - the CLI owns `stages.*`; never edit it directly.

## Stage → artifact mapping

| Stage     | File                   | task.json fields owned                                                 |
| --------- | ---------------------- | ---------------------------------------------------------------------- |
| onboard   | _(none)_               | -                                                                      |
| brief     | `01-brief.md`          | `acceptanceCriteria`, `estimatedBaseline`                              |
| plan      | `02-plan.md`           | -                                                                      |
| implement | `03-implementation.md` | `filesTouched`                                                         |
| debug     | `04-debug-notes.md`    | `knowledgeHarvested` (via CLI)                                         |
| test      | `05-tests.md`          | `acceptanceCriteria[].covered`/`.testRef` (via `relay criteria cover`) |
| review    | `06-review.md`         | -                                                                      |
| pr        | `07-pr.md`             | -                                                                      |
| docs      | _(none)_               | -                                                                      |

## Critical gotchas

- **`AcceptanceCriterion.covered`** must only be `true` when a real test verifies it. An honest amber (`testable:true, covered:false`) is a product requirement - never mark something covered just because it was implemented.
- **`atomicWrite`** (in `cli/src/fsutil.ts`) is mandatory for all file writes in the CLI - it uses a temp-file + rename to prevent corruption. Never use `writeFile` directly for task.json.
- **`gotchas.md` entries** use a strict format that `knowledge.ts`'s `parseGotchas` requires: `## gotcha-NNN - Title` heading, then `- **field:** value` bullets in exact order. Off-format entries silently fail to compile into `relay-data.json`. Activate the `relay-harvest` skill for the exact template.
- **paths.ts exports functions, not constants** - all `.bob/` paths are computed from `process.cwd()` at call time. Tests `chdir` into a scratch temp dir per test; anything that caches a path at import time will break tests.
- **`cli/` uses `"module": "NodeNext"`** - all local imports must use `.js` extensions, even for `.ts` source files (e.g. `import { foo } from './fsutil.js'`).
- See gotcha-001 in `.bob/knowledge/gotchas.md` for the current live example of a harvested knowledge entry and its exact required format.

## Code style

- TypeScript strict mode, ESM (`"type":"module"`), Node 20+, npm workspace.
- No linter config exists - follow existing patterns (2-space indent, single quotes, trailing commas in multi-line).
