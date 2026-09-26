---
name: relay-baton
description: Relay's file conventions and task.json update rules - where each stage writes, what fields it owns, and the CLI commands that log timing. Use whenever writing or updating anything under .bob/tasks/ or .bob/knowledge/.
---

# Relay baton conventions

**Directory:** `.bob/tasks/T-NNN-<slug>/` - one dir per task.

**Stage → artifact filename** (fixed, from `cli/src/stageArtifact.ts`):

| stage         | file                                           |
| ------------- | ---------------------------------------------- |
| brief         | `01-brief.md`                                  |
| plan          | `02-plan.md`                                   |
| implement     | `03-implementation.md`                         |
| debug         | `04-debug-notes.md`                            |
| test          | `05-tests.md`                                  |
| review        | `06-review.md`                                 |
| pr            | `07-pr.md`                                     |
| onboard, docs | none - they update `.bob/knowledge/` instead |

Each stage owns exactly one artifact file. Never write into another stage's
file.

**`task.json`** (shape: `cli/src/types.ts` → `Task`) - write only the
fields your stage owns: `brief` → `acceptanceCriteria`; `implement` →
`filesTouched`; `debug` → `knowledgeHarvested` (via `relay harvest`, not by
hand); `test` → `acceptanceCriteria[].covered`/`.testRef` (via `relay
criteria cover`). `stages.*` is written by the CLI itself on `stage
start`/`stage end` - never edit it directly.

**CLI commands** (exact syntax, `cli/src/index.ts`):

```
npx relay stage start <stage>
npx relay stage end <stage>
npx relay criteria cover <id> --test <file:line>
npx relay harvest <gotcha-id>
npx relay compile
npx relay status
```

Every stage brackets its work in `stage start`/`stage end`, then
`compile`. A failed command: report it, keep going - never abort the stage.
