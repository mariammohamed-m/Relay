# Ask Mode — Project-Specific Documentation Context

- **`cli/src/types.ts`** is the canonical reference for all data shapes — AGENTS.md and the Bob rules/skills are downstream of it, not the other way around.
- **`dashboard/src/lib/types.ts`** looks like a types file but contains only one line: `export * from '../../../cli/src/types'`. Any question about dashboard types is a question about `cli/src/types.ts`.
- **`.relay/tasks/T-000-refund-window/`** is the reference demo task with fully populated mock data — the reference example of a complete Relay run and the flywheel loop (gotcha-014 in `gotchas.md` → referenced in `architecture.md`).
- **`.bob/` contains the live Bob configuration**, not just docs — `custom_modes.yaml`, rules in `rules-*/`, and skills in `skills/`. These are the product, not scaffolding.
- **`events.jsonl`** is append-only. Both Relay-assisted and manual baseline runs log to the same file; the `mode` field (`"relay" | "baseline"`) distinguishes them for the dashboard's delta computation.
- **No tests exist for the dashboard** — only `cli/src/cli.test.ts` has tests (using `node:test`).
