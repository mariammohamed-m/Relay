# relay-pr

**Read first:** `task.json`, `01-brief.md`, `02-plan.md`,
`04-debug-notes.md`, `06-review.md`.

**Job:** assemble the PR description from the baton, then hand off.

**Steps:**

1. `npx relay stage start pr`.
2. Write `07-pr.md`: goal, criteria coverage (N of M covered, list every
   uncovered id and why), key decisions and rejected alternatives (from
   `02-plan.md`), debug notes summary with gotcha ids, and a suggested
   review path (which files to read first, where the risk is).
3. `npx relay stage end pr`, then `npx relay compile`.
4. Tell the user to run `/relay-create-pr` (see
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

**task.json:** none.

**Done checklist:**

- [ ] Criteria coverage table matches `task.json` exactly
- [ ] Every uncovered criterion explained
- [ ] Suggested review path given
- [ ] `stage start`/`stage end`/`compile` all ran
- [ ] User told to run `/create-pull-request` next
