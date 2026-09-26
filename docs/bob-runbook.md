# Bob runbook

The canonical prompt for each of Relay's nine stages, and what mode it runs
in. `docs/demo-script.md` quotes these verbatim - if you change a prompt
here, update the demo script too.

**Status:** `.bob/` itself (the actual `custom_modes.yaml`, rules, and
skills) is still Sprint 4 scaffolding - see `.bob/README.md`. This runbook
describes what those nine modes _should_ be once they exist, so the live
demo has something concrete to run today rather than waiting on Sprint 4.
The mode shape below (`slug` / `name` / `roleDefinition` / `whenToUse` /
`description` / `groups`) is the real Bob custom-mode format - confirmed
against `IBM/galaxium-travels`' own `.bob/custom_modes.yaml` (Bob's own
tutorial demo app, Apache-2.0; see `sample-project/SOURCE.md`), not
guessed. Wiring these nine definitions into an actual `.bob/custom_modes.yaml`
is Sprint 4 work and out of scope here - this file is the spec for it.

## Shared rule, every mode

Every stage mode should carry this rule (Relay's "baton contract" from the
top-level README): **read `.bob/relay/knowledge/` and the current task's prior
stage artifacts before doing anything else, and end by writing this stage's
artifact and running the matching `relay stage end` command before handing
off.** The per-stage entries below only note what's specific to that stage.

---

### 1. `relay-onboard`

- **roleDefinition:** You're orienting on a task before any decisions get
  made. Read `.bob/relay/knowledge/architecture.md` and `.bob/relay/knowledge/gotchas.md`
  in full, then map the parts of `sample-project/` this task will touch.
  You write no code and make no decisions in this mode.
- **whenToUse:** The very start of a task, before the ticket has even been
  read closely.
- **groups:** `read`, `execute` (to run `relay` CLI commands), `skill`
- **Canonical prompt:**
  > Onboard for `@.bob/relay/tasks/T-00N-<slug>/`. Read `.bob/relay/knowledge/architecture.md`
  > and `.bob/relay/knowledge/gotchas.md` first. Then map the parts of
  > `sample-project/` this task will touch - don't guess, read the actual
  > files. Run `npx relay stage start onboard` before you begin and
  > `npx relay stage end onboard` once you're oriented.
- **Demo note:** if parallel subagents are available, split the codebase
  map and the knowledge-base read across them - this is the
  `ParallelLanes` moment for `onboard`.

### 2. `relay-brief`

- **roleDefinition:** You turn a ticket into acceptance criteria. Extract
  every criterion, however it's phrased (bullet or prose). Flag anything
  too vague to test as written, and propose a measurable rewrite. Read
  ticket **comments**, not just the description - requirements hide there.
- **whenToUse:** Once onboarding is done and the ticket PDF is available.
- **groups:** `read`, `execute`, `skill` (document-understanding / PDF
  extraction)
- **Canonical prompt:**
  > Extract acceptance criteria from `sample-project/docs/tickets/REF-88.pdf`
  >
  > - the full ticket including every comment. List each criterion as
  >   testable or not; for anything not testable, propose a measurable
  >   rewrite. Write `01-brief.md` and run `npx relay criteria list` to
  >   confirm what got recorded, then `npx relay stage end brief`.
- **Demo note:** this is where AC-4's vagueness and the comment-buried
  audit-log requirement either get caught or don't - see
  `docs/demo-answer-key.md`.

### 3. `relay-plan`

- **roleDefinition:** You propose an implementation approach before writing
  code, including alternatives you considered and rejected, and why.
- **whenToUse:** After the brief is written and criteria are recorded.
- **groups:** `read`, `execute`, `skill`
- **Canonical prompt:**
  > Propose an approach for `@.bob/relay/tasks/T-00N-<slug>/01-brief.md`'s
  > criteria. Include at least one alternative you considered and rejected,
  > and why. Flag the highest-risk part of the change explicitly. Write
  > `02-plan.md`, then `npx relay stage end plan`.

### 4. `relay-implement`

- **roleDefinition:** You make the change described in the plan, and record
  any deviation from that plan as it happens - don't silently improvise.
- **whenToUse:** Once the plan is written.
- **groups:** `read`, `execute`, `skill`, `edit` (scoped to `sample-project/`)
- **Canonical prompt:**
  > Implement `02-plan.md` inside `sample-project/`. If you deviate from
  > the plan, say so and why in `03-implementation.md` as you go - don't
  > just do something different silently. Run
  > `npx relay stage end implement` once it's done, even if tests haven't
  > been run yet (that's the `test`/`debug` stages' job).

### 5. `relay-debug`

- **roleDefinition:** Something failed. Find the actual root cause - not
  the first plausible guess - fix it, and write down what you found for
  the knowledge base.
- **whenToUse:** A test fails, or a manual check turns up wrong behavior.
- **groups:** `read`, `execute`, `skill`, `edit`
- **Canonical prompt:**
  > A test is failing. Investigate - don't guess. Find the actual root
  > cause, fix it, and write `04-debug-notes.md` with the symptom, root
  > cause, and fix. Then run `npx relay harvest <id> --task T-00N` to
  > record it in `.bob/relay/knowledge/gotchas.md` for future tasks, and
  > `npx relay stage end debug`.
- **Demo note:** this is the live centerpiece - the planted timezone bug
  (`docs/demo-answer-key.md`) should surface here, and the harvest should
  appear live in the dashboard's KnowledgeFeed.

### 6. `relay-test`

- **roleDefinition:** Write tests that verify the acceptance criteria - not
  just that the code runs. Mark each criterion covered only when a real
  test verifies it; leaving one honestly uncovered is correct if no test
  exists yet.
- **whenToUse:** After implementation (and any debugging) is done.
- **groups:** `read`, `execute`, `skill`, `edit` (scoped to
  `sample-project/tests/`)
- **Canonical prompt:**
  > Write tests in `sample-project/tests/` for each criterion in
  > `01-brief.md`. For each one, run `npx relay criteria cover <id> --test <ref>`
  > if it's genuinely covered, or leave it uncovered - don't mark
  > something covered because it merely compiles. Write `05-tests.md`,
  > then `npx relay stage end test`.

### 7. `relay-review`

- **roleDefinition:** Read-only. Review the diff against the plan, the
  acceptance criteria, and the knowledge base - flag anything the
  implementation missed or got wrong. Never edit files in this mode.
- **whenToUse:** After tests are written.
- **groups:** `read`, `execute`, `skill`
- **Canonical prompt:**
  > Review this task's diff against `02-plan.md`, `01-brief.md`'s
  > criteria, and `.bob/relay/knowledge/gotchas.md`. If subagents are
  > available, run plan-conformance, criteria-coverage, and
  > gotcha-avoidance passes in parallel. Write `06-review.md` with a
  > suggested reading order for a human reviewer, then
  > `npx relay stage end review`.

### 8. `relay-pr`

- **roleDefinition:** Write the PR description from the full baton - what
  changed, why, what's not covered, and what a reviewer should read first.
- **whenToUse:** After review.
- **groups:** `read`, `execute`, `skill`
- **Canonical prompt:**
  > Write `07-pr.md`: goal, acceptance-criteria coverage table (including
  > anything left honestly uncovered), key decisions, and a suggested
  > review path. Then `npx relay stage end pr`.

### 9. `relay-docs`

- **roleDefinition:** Close the loop - make sure anything learned this task
  is actually written where the next task's `onboard` will read it.
- **whenToUse:** Last stage, after the PR is written.
- **groups:** `read`, `execute`, `skill`, `edit` (scoped to
  `.bob/relay/knowledge/`)
- **Canonical prompt:**
  > Confirm everything harvested this task (`npx relay status`) is
  > correctly reflected in `.bob/relay/knowledge/`. Update
  > `.bob/relay/knowledge/architecture.md` if this task changed how something
  > works. Then `npx relay stage end docs`.

## Recovering a cancelled stage

Bob has no way to tell Relay that a user cancelled a running stage mid-way,
so the CLI has to detect and recover it itself:

- **If you cancel a stage in Bob**, run `npx relay stage cancel <stage>`
  right after - it restores the stage's artifact and `task.json` from the
  last good snapshot, or (if this was the stage's first-ever run) marks it
  `failed` with a reason instead of leaving it stuck `running` forever.
- If you forget, the next `npx relay stage start <other-stage>` on the same
  task detects the abandoned `running` stage automatically and recovers it,
  with a printed warning.
- `npx relay recover` finds every stage across all tasks stuck `running`
  past the configured timeout (30 minutes by default) and, with `--yes`,
  recovers each one the same way.
