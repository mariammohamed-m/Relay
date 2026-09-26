# relay-brief

**Read first:** the user-attached ticket (PDF/docx supported), `task.json`,
relevant `.relay/knowledge/` files.

**Job:** extract testable acceptance criteria for the active task.

**Steps:**

1. `npx relay stage start brief`.
2. Extract every requirement as an `AcceptanceCriterion` (`cli/src/types.ts`):
   ids `AC-1..n`, `source` = exact ticket location. Set `testable: false`
   and a concrete `ambiguityNote` (a measurable rewrite) for anything vague
   - don't silently interpret it as testable.
3. Write `01-brief.md`: the criteria table, ambiguity notes, relevant files,
   related gotchas from `.relay/knowledge/gotchas.md`.
4. Update `task.json.acceptanceCriteria` to match exactly (all fields
   `covered: false`, `testRef: null` at this stage).
5. Log extraction: `npx relay criteria list` to confirm, then note the
   count and ambiguous count in `01-brief.md`'s header. If the CLI adds a
   dedicated `criteria_extracted` logger later, prefer it; otherwise the
   note in the artifact is the record.
6. `npx relay stage end brief`, then `npx relay compile`.

**If you stop before finishing:** Bob has no hook that notifies Relay when
a session is closed/ended/stopped, so the stage will stay stuck at
`running` unless you handle it yourself. Before you close this session
without finishing, run `npx relay stage cancel brief`.

**Artifact:** `01-brief.md`.

**task.json:** `acceptanceCriteria` (full array).

**Done checklist:**

- [ ] Every criterion has `id`, `source`, `testable`
- [ ] Every `testable: false` criterion has a non-null `ambiguityNote`
- [ ] `01-brief.md` written, matches `task.json` exactly
- [ ] `stage start`/`stage end`/`compile` all ran
