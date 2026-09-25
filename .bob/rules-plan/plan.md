<!-- Applies to every use of Bob's built-in Plan mode in this workspace, not only the Relay `plan` stage - see FORMAT-NOTES.md. -->

# Relay rules for Plan mode

**Read first:** `01-brief.md`, `task.json.acceptanceCriteria`, relevant
`.relay/knowledge/` files.

**Job:** produce an ordered implementation plan for the active task's
current brief. Do not implement - Plan mode stops for user approval.

**Steps:**

1. `npx relay stage start plan`.
2. Write `02-plan.md`: ordered steps, files to touch, risks (call out any
   known gotcha that's relevant), and an **Alternatives considered**
   section naming every rejected approach and why.
3. Stop and wait for explicit user approval before any implementation
   begins - that happens in a separate `implement` stage/mode.
4. `npx relay stage end plan`, then `npx relay compile`.

**If you stop before finishing:** Bob has no hook that notifies Relay when
a session is closed/ended/stopped, so the stage will stay stuck at
`running` unless you handle it yourself. Before you close this session
without finishing, run `npx relay stage cancel plan`. (This does not apply
to the normal stop in step 3, which waits for user approval - that stage
is finished with `stage end`, not cancelled.)

**Artifact:** `02-plan.md`.

**task.json:** none (plan doesn't touch criteria or files-touched).

**Done checklist:**

- [ ] Steps are ordered and file-specific
- [ ] Alternatives considered, with rejection reasons
- [ ] No code written this stage
- [ ] `stage start`/`stage end`/`compile` all ran
