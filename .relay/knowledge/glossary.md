# Glossary

- **Baton** - the structured `.relay/` context files carried from one
  pipeline stage to the next.
- **Flywheel** - the loop where `debug`-stage knowledge harvested into
  `.relay/knowledge/` is read back during the next task's `onboard` stage.
- **Stage** - one of the nine pipeline steps: `onboard`, `brief`, `plan`,
  `implement`, `debug`, `test`, `review`, `pr`, `docs`. See `StageId` in
  `cli/src/types.ts`.
- **Gotcha** - a harvested debugging lesson (`KnowledgeEntry`), stored in
  `gotchas.md`.
- **Honest amber** - a criterion marked `testable: true, covered: false` on
  purpose, because it's genuinely untested - never faked as covered.
- **Baseline run** - a manual (non-Relay-assisted) run of the same task,
  logged with `mode: "baseline"` in `events.jsonl`, used to measure Relay's
  impact.
