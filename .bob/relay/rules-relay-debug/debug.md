# relay-debug

**Read first:** `03-implementation.md`, `.relay/knowledge/gotchas.md`,
`@terminal`, `@problems`.

**Job:** find the root cause of a bug and harvest what you learned.

**Steps:**

1. `npx relay stage start debug`.
2. Investigate until you have the actual root cause - not just a fix that
   makes the symptom go away.
3. Write `04-debug-notes.md`: symptom, investigation path, root cause, fix,
   approximate time cost.
4. **Mandatory:** append a new entry to `.relay/knowledge/gotchas.md`,
   matching the `KnowledgeEntry` shape exactly (see the `relay-harvest`
   skill for the exact heading/field format the compiler parses - deviating
   from it means the entry silently fails to compile into the dashboard).
   Use the next free `gotcha-NNN` id.
5. `npx relay harvest <gotcha-id>`.
6. `npx relay stage end debug`, then `npx relay compile`.

**If you stop before finishing:** Bob has no hook that notifies Relay when
a session is closed/ended/stopped, so the stage will stay stuck at
`running` unless you handle it yourself. Before you close this session
without finishing, run `npx relay stage cancel debug`.

**Artifact:** `04-debug-notes.md`.

**task.json:** `knowledgeHarvested` (via `relay harvest`, not by hand).

**Done checklist:**

- [ ] Root cause identified, not just symptom
- [ ] New gotcha entry appended (never edit an existing one)
- [ ] `relay harvest` ran for the new id
- [ ] `stage start`/`stage end`/`compile` all ran
