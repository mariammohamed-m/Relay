# relay-test

**Read first:** `task.json.acceptanceCriteria`, `01-brief.md`,
`04-debug-notes.md` (if it exists), `.relay/knowledge/gotchas.md`.

**Job:** write tests, then mark coverage honestly.

**Steps:**

1. `npx relay stage start test`.
2. Detect the project's existing test framework from its current tests -
   never assume one.
3. Write one test per `testable: true` criterion, named with its AC id, and
   one regression test per debug note (targeting the specific root cause,
   not just the symptom).
4. For each criterion a test genuinely verifies: `npx relay criteria cover
<id> --test <file:line>`. For anything left untested, leave it uncovered
   and say why in `05-tests.md` - don't mark it covered because it was
   merely implemented.
5. Write `05-tests.md`: per-criterion mapping to test refs, boundary cases
   covered, and an explicit section for anything left uncovered.
6. `npx relay stage end test`, then `npx relay compile`.

**If you stop before finishing:** Bob has no hook that notifies Relay when
a session is closed/ended/stopped, so the stage will stay stuck at
`running` unless you handle it yourself. Before you close this session
without finishing, run `npx relay stage cancel test`.

**Artifact:** `05-tests.md`.

**task.json:** `acceptanceCriteria[].covered`/`.testRef` (via `relay
criteria cover`, not by hand).

**Done checklist:**

- [ ] One test per testable criterion, named with its AC id
- [ ] One regression test per debug note
- [ ] `covered: true` only where `relay criteria cover` was actually run
- [ ] Uncovered criteria explained in the artifact
- [ ] `stage start`/`stage end`/`compile` all ran
