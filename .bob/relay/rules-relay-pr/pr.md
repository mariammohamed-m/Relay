# relay-pr

**Read first:** `task.json`, `01-brief.md`, `02-plan.md`,
`04-debug-notes.md`, `06-review.md`.

**Job:** run a conflict check, then assemble the PR description from the
baton and hand off.

**Steps:**

1. `npx relay stage start pr`.

2. **Conflict check — do this before writing anything.**
   Run: `npx relay pr check-conflicts`
   (add `--base <branch>` if the target branch isn't `main`).

   - If the command exits non-zero (conflicts found), **stop**. Do not
     proceed to write `07-pr.md` or open a PR. Instead:
     a. Tell the user exactly which files are conflicted (the command
        lists them).
     b. Ask the user to decide: fix conflicts on the branch first, or
        document them explicitly in the PR for the reviewer to resolve.
     c. Wait for the user's instruction before continuing.
   - If the command exits zero (no conflicts), continue to step 3.

   **Why the rule can't gate the built-in workflow:** Bob's built-in
   `/create-pull-request` is a user-invoked slash command, not a step this
   mode controls; the mode cannot intercept it. The conflict check is
   therefore surfaced here, before `07-pr.md` is written, so the user has a
   clear decision point before they ever invoke the PR command. This is the
   "embed results and let the user decide" approach described in the task
   spec — not auto-resolution.

3. Write `07-pr.md`:
   - If **conflicts were found** (and the user chose to document rather than
     fix them), start `07-pr.md` with a clearly marked warning block:

     ```
     ## ⚠ Merge conflicts detected

     This branch has **N unresolved merge conflict(s)** against `<baseBranch>`.
     A reviewer cannot merge this PR until they are resolved.

     Conflicted files:
     - path/to/file-1.ts
     - path/to/file-2.ts
     ```

     Then continue with the normal PR description below it.

   - Whether or not conflicts exist, include: goal, criteria coverage
     (N of M covered, list every uncovered id and why), key decisions and
     rejected alternatives (from `02-plan.md`), debug notes summary with
     gotcha ids, and a suggested review path (which files to read first,
     where the risk is).

4. `npx relay stage end pr`, then `npx relay compile`.

5. Tell the user to run `/relay-create-pr` (see
   `.bob/commands/relay-create-pr.md`) to open the PR using `07-pr.md`
   verbatim as the body - this mode does not open the PR itself. That
   command falls back to Bob's built-in `/create-pull-request` (syncing
   its generated content back into `07-pr.md` afterward) only if the `gh`
   CLI isn't available.

**If you stop before finishing:** Bob has no hook that notifies Relay when
a session is closed/ended/stopped, so the stage will stay stuck at
`running` unless you handle it yourself. Before you close this session
without finishing, run `npx relay stage cancel pr`.

**Artifact:** `07-pr.md`.

**task.json:** `conflictCheck` (written by `relay pr check-conflicts`).

**Done checklist:**

- [ ] `relay pr check-conflicts` ran and result stored on task.json
- [ ] If conflicts found: user informed and asked to decide before proceeding
- [ ] If conflicts found and user chose to document: `07-pr.md` opens with ⚠ conflict block
- [ ] Criteria coverage table matches `task.json` exactly
- [ ] Every uncovered criterion explained
- [ ] Suggested review path given
- [ ] `stage start`/`stage end`/`compile` all ran
- [ ] User told to run `/relay-create-pr` next
