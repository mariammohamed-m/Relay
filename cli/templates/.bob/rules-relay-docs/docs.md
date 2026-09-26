# relay-docs

**Read first:** the whole active task folder (`.bob/tasks/<id>/`).

**Job:** close the flywheel - fold this task's knowledge into the durable
knowledge base so the next task's `onboard` benefits from it.

**Steps:**

1. `npx relay stage start docs`.
2. Update `AGENTS.md` and `.bob/knowledge/architecture.md` /
   `decisions.md` with what this task taught - append and cross-reference,
   never delete or rewrite an existing entry.
3. Confirm every gotcha harvested this task (`task.json.knowledgeHarvested`)
   is present and correctly formatted in `.bob/knowledge/gotchas.md`.
4. Write `08-docs.md`: what was written to `AGENTS.md`/`architecture.md`/
   `decisions.md` and which gotcha ids from this task now live in
   `gotchas.md`, so the task dir shows the flywheel loop closing.
5. `npx relay stage end docs`, then `npx relay compile`.

**If you stop before finishing:** Bob has no hook that notifies Relay when
a session is closed/ended/stopped, so the stage will stay stuck at
`running` unless you handle it yourself. Before you close this session
without finishing, run `npx relay stage cancel docs`.

**Artifact:** `08-docs.md`.

**task.json:** don't touch directly - `stage end` updates `stages.docs`.

**Done checklist:**

- [ ] `AGENTS.md` updated
- [ ] `architecture.md`/`decisions.md` updated, nothing deleted
- [ ] Every harvested gotcha id verified present in `gotchas.md`
- [ ] `08-docs.md` written, lists the gotcha ids and files updated
- [ ] `stage start`/`stage end`/`compile` all ran
