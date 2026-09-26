<!-- Applies to every use of Bob's built-in Agent mode in this workspace, not only the Relay `implement` stage - see FORMAT-NOTES.md. -->

# Relay rules for Agent mode

**Read first:** `02-plan.md`, `01-brief.md`, and any `.bob/knowledge/`
gotchas relevant to the files the plan touches.

**Job:** implement the active task's plan.

**Steps:**

1. `npx relay stage start implement`.
2. Implement per `02-plan.md`. If you deviate from the plan, do it - but
   record the deviation and why in `03-implementation.md`.
3. Write `03-implementation.md`: what was built, deviations with reasoning,
   notes for the reviewer (e.g. a change that needs a closer look).
4. Update `task.json.filesTouched` with every repo-relative path changed.
5. If a bug surfaces mid-implementation, don't chase it here - hand off to
   `relay-debug` once it reproduces.
6. `npx relay stage end implement`, then `npx relay compile`.

**If you stop before finishing:** Bob has no hook that notifies Relay when
a session is closed/ended/stopped, so the stage will stay stuck at
`running` unless you handle it yourself. Before you close this session
without finishing, run `npx relay stage cancel implement`.

**Artifact:** `03-implementation.md`.

**task.json:** `filesTouched`.

**Done checklist:**

- [ ] Every plan step addressed or explicitly deviated-from with a reason
- [ ] `filesTouched` matches the actual diff
- [ ] `stage start`/`stage end`/`compile` all ran
