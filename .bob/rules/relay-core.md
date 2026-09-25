# Relay core rules (global - applies to every mode)

- Resolve the active task by reading `.relay/.active` (a task id like
  `T-000`). Never hardcode a task id. If `.relay/.active` is missing or
  stale, run `npx relay status` to confirm the right task before acting.
- Before writing anything, read the relevant files under `.relay/knowledge/`
  (`gotchas.md`, `architecture.md`, `decisions.md`, `glossary.md`) - don't
  repeat a mistake that's already documented.
- Write only in the shapes defined by `cli/src/types.ts`. Never invent a
  field or rename one. `task.json` fields you don't own this stage: leave
  untouched.
- Never mark something done, covered, or fixed that wasn't. An honest
  "uncovered" or "pending" is correct output.
- Never overwrite another stage's artifact file. Each stage owns exactly one
  file (see the stage → artifact table in `AGENTS.md` / `CLAUDE.md`).
- Keep every artifact concise and factual - decisions and reasoning, not
  narration of what you did.
- Every stage: run `npx relay stage start <stage>` before starting work and
  `npx relay stage end <stage>` after writing the artifact, then
  `npx relay compile`. If a command fails, report the failure and continue
  the stage - never abort the stage over a CLI error.
- If a stage run is cancelled, the CLI handles recovery (`npx relay stage
  cancel`/`npx relay recover`) - don't hand-edit `task.json` to fix it.
