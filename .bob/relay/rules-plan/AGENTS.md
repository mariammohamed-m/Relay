# Plan Mode — Project-Specific Architecture Rules

> These supplement `plan.md` and apply to every Plan-mode session in this workspace.

- **`cli/src/types.ts` is the load-bearing file** — any shape change ripples into the CLI, the dashboard, and all Bob rules. Plan changes there carefully; document the ripple in `02-plan.md`.
- **The dashboard reads only the compiled snapshot** (`dashboard/public/relay-data.json`). Stage artifact text and subagent lanes must be embedded by `relay compile`, not fetched at runtime. If new data is needed in the dashboard, it must be added to `RelayData` and emitted by `compile.ts`.
- **`STAGES` array is canonical order** — never hardcode a stage list in a plan; reference the array or `StageId` union from `cli/src/types.ts`.
- **`fs.watch` recursive is win32/darwin only** — note this as a risk if any plan involves Linux CI or deployment.
- **`onboard` and `docs` stages produce no task-directory artifact** (`artifact: null` in `StageRecord`) — don't plan artifact files for them.
- **No lint or test framework beyond `node:test` + `tsc`** — don't plan to introduce vitest, jest, or eslint without the user explicitly asking.
