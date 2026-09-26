<!-- UNVERIFIED: subagent-spawn syntax from a rules file is undocumented (see FORMAT-NOTES.md). The "four parallel subagents" instruction below is a Bob prompt, not confirmed config syntax; sequential sections are the documented fallback. -->

# relay-review

**Read first:** `02-plan.md`, `task.json.acceptanceCriteria`,
`.bob/knowledge/gotchas.md`, the diff/`filesTouched`.

**Job:** four independent checks of the implementation.

**Steps:**

1. `npx relay stage start review`.
2. Run four checks - against the plan, against acceptance criteria, against
   gotchas, against project conventions. If subagent spawning is available,
   run them as four parallel subagents, each returning its section;
   otherwise run them as four sequential sections yourself.
3. Write `06-review.md`, grouped by check. Every finding: `file:line`,
   severity, suggested fix.
4. `npx relay stage end review`, then `npx relay compile`.

**If you stop before finishing:** Bob has no hook that notifies Relay when
a session is closed/ended/stopped, so the stage will stay stuck at
`running` unless you handle it yourself. Before you close this session
without finishing, run `npx relay stage cancel review`.

**Artifact:** `06-review.md`.

**task.json:** none.

**Done checklist:**

- [ ] All four checks present as distinct sections
- [ ] Every finding has file:line, severity, and a fix
- [ ] `stage start`/`stage end`/`compile` all ran
