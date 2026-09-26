<!-- UNVERIFIED: subagent-spawn syntax from a rules file is undocumented (see FORMAT-NOTES.md). The "spawn one subagent per subsystem" instruction below is written as a Bob prompt, not confirmed config syntax. -->

# relay-onboard

**Read first:** `AGENTS.md` (if present), every file in `.relay/knowledge/`.

**Job:** orient on the codebase for the active task (from `.relay/.active`)
and surface one good first task.

**Steps:**

1. `npx relay stage start onboard`.
2. Read `gotchas.md`, `decisions.md`, and `glossary.md` in full (small,
   append-only files). For `architecture.md`, read it in full while it's
   small; once it grows large, skim it for the subsystem you're about to
   touch instead of re-reading the whole thing every time.
3. Explore the target codebase by subsystem. If subagent spawning is
   available in this mode, spawn one `explore` subagent per top-level
   subsystem; each returns a short section (what it does, key files,
   relevant gotchas). Merge their sections yourself - don't just concatenate.
4. Update `.relay/knowledge/architecture.md`: add or extend sections for
   what you found, referencing existing gotcha ids (`gotcha-NNN`) wherever
   a subsystem has a known issue. Never rewrite an existing gotcha entry -
   that file belongs to `relay-debug`/`relay-docs`.
5. Write the artifact **`.relay/tasks/<task-id>/00-onboard.md`** (resolve
   `<task-id>` from `.relay/.active`). This file is the primary deliverable
   of the onboard stage - do not put this content only in chat. It must
   contain: per-subsystem summary (what each subsystem does, key files,
   sharp edges/gotchas), and the one suggested first task. Keep it factual
   and skimmable - bullets and short paragraphs, not prose narration.
6. Suggest that same first task in your final chat message (one sentence
   pointing at the file for full detail).
7. `npx relay stage end onboard`, then `npx relay compile`.

**If you stop before finishing:** Bob has no hook that notifies Relay when
a session is closed/ended/stopped, so the stage will stay stuck at
`running` unless you handle it yourself. Before you close this session
without finishing, run `npx relay stage cancel onboard`.

**Artifact:** `.relay/tasks/<task-id>/00-onboard.md`

**task.json:** don't touch directly - `stage end` updates `stages.onboard`.

**Done checklist:**

- [ ] Knowledge base read (full for gotchas/decisions/glossary; architecture.md skimmed if large)
- [ ] `architecture.md` updated, references existing gotcha ids
- [ ] No existing gotcha entry rewritten
- [ ] `00-onboard.md` written in the task directory (not only in chat)
- [ ] `stage start`/`stage end`/`compile` all ran
