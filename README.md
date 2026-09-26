# Relay

**A developer's work passes through ~8 stages - onboarding, brief, planning,
implementation, debugging, testing, review, and PR - and every stage starts
from zero.** The AI assistant that helps you implement doesn't know what the
plan was. The reviewer doesn't know why approach A was chosen over B. The PR
description never mentions the two hours lost to a caching quirk, so the next
developer loses those same two hours. The cost isn't inside any single
stage - it's in the handoffs between them, and nothing measures it.

Relay measures it, and closes the gap.

## The baton

Relay's core idea: carry context forward as a **baton**, not tribal memory.
At every stage, structured files land in `.bob/relay/` - Relay's own
subfolder inside your project's existing `.bob/` config - plain Markdown and
JSON, committed to the repo alongside the code they describe:

- `.bob/relay/tasks/T-NNN-<slug>/` - one directory per task, one file per
  stage (`00-onboard.md` → `07-pr.md`), plus a `task.json` tracking status,
  acceptance criteria, and files touched.
- `.bob/relay/knowledge/` - the durable, cross-task memory: gotchas,
  architecture notes, decisions, glossary.
- `.bob/relay/metrics/events.jsonl` - a timestamped event log of every stage
  transition, used to measure relay-assisted runs against manual baselines.
- `.bob/relay/.active` - the id of the currently active task (what `relay
  status` and every Bob mode read to know which task they're working on).

Plain files in git, not a database, is deliberate:

- Bob reads them natively via `@.bob/relay/...` context mentions - no custom
  retrieval layer.
- They survive in git history and diff like any other change.
- The dashboard is a dumb static reader of one compiled JSON file - no
  server, nothing that can go down mid-demo.

## The flywheel

The differentiator isn't the file format - it's that the baton is a loop, not
a relay race with one winner. Knowledge harvested during `debug` gets written
to `.bob/relay/knowledge/gotchas.md`. The **next** task's `onboard` stage
reads that file before Bob writes a line of code. A bug found once is a bug
avoided forever after. Most developer tooling decays as a codebase grows -
more files, more history, more to search. Relay's knowledge base compounds
instead: every finished task makes the next one faster.

## Architecture

Relay is two things working off one shared data contract (`cli/src/types.ts`):

1. **Bob IDE configuration** (`.bob/relay/`) - custom modes, rules, and
   skills that make Bob read `.bob/relay/knowledge/` on entry and write
   structured stage artifacts on exit, instead of leaving context in
   scrollback.
2. **CLI** (`cli/`) - scaffolds task directories, appends to the event log,
   compiles everything into the dashboard's data file, and ships a
   pre-built visual dashboard (`cli/dashboard-dist/`) that `relay dashboard`
   serves directly - no separate frontend project or build step for
   consumers of the npm package.

See `docs/architecture.md` for the full diagram.

## Repo layout

```
.bob/            Bob IDE config: custom modes, rules, skills; .bob/relay/ is
                 Relay's own isolated subfolder (this repo's dogfooded task)
cli/             relay CLI - scaffold, events, compile, report, doctor,
                 dashboard (bundled pre-built React app in dashboard-dist/)
bob-sessions/    required Bob session-summary screenshots
docs/            architecture, demo script, metrics methodology
```

## Getting started

Requires Node 20+. From the repo root (npm workspace: `cli`):

```bash
npm install                 # installs the cli workspace
npm run build                # tsc for cli
```

From `cli/` directly:

```bash
npm run build   # tsc -p tsconfig.json
npm run dev      # tsc --watch
npm run test     # tsc + node --test dist/*.test.js (uses node:test, not vitest/jest)
```

There is no lint setup and no test-name filter — to isolate one test,
temporarily comment out the others in `cli/src/cli.test.ts`.

Once built, run the CLI as `npx relay <command>` from the repo root (or
`node cli/dist/index.js <command>` if `npx relay` doesn't resolve — see
Troubleshooting).

## Installing Relay in your own project

```bash
npm install -g bob-relay
relay start "<title>"
```

`relay start` does everything: scaffolds `.bob/relay/` (Bob IDE modes,
rules, skills, config, knowledge stubs, empty metrics log) if it doesn't
exist yet - leaving the rest of an existing `.bob/` untouched - creates and
activates a task, compiles it, and opens the visual dashboard in your
browser. The only thing left for you to do is open this repo in Bob IDE and
switch to the Relay Onboard mode. `--no-dashboard` skips the compile+dashboard
step, `--no-open` starts the dashboard without launching a browser tab, and
`--port <n>` picks a different port. `relay init` refuses to touch an
existing `.bob/relay/` unless you pass `--force`, which still never
overwrites real tasks or harvested knowledge.

Prefer not to install globally? `npx bob-relay init` works for a single
one-off command, but a bare `npx relay ...` afterward will try to resolve an
unrelated package literally named `relay` from the npm registry unless
`bob-relay` is installed somewhere `npx` can find it locally — so follow it
with `npm install --save-dev bob-relay` in the project before relying on
`npx relay ...` again.

## CLI reference

All commands operate on the `.bob/relay/` baton in the current working
directory. Run `relay <command> --help` for the exhaustive, always-current
flag list — this table is a summary.

### Setup

| Command                                                                                                      | What it does                                                                                                           |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `relay start <title> [--source-type ticket\|issue\|adhoc] [--source-ref <ref>] [--baseline] [--tag <tag>] [--port <port>] [--no-dashboard] [--no-open] [--force]` | Quickstart: runs `init` if `.bob/relay/` doesn't exist yet, creates and activates a task, compiles, and opens the dashboard — everything short of opening Bob. |
| `relay init [--force]`                                                                                        | Scaffolds `.bob/relay/` if absent (idempotent), leaving the rest of an existing `.bob/` untouched. `--force` re-scaffolds it, but never overwrites real tasks or harvested knowledge. |
| `relay dashboard [--port <port>] [--no-open]`                                                                  | Serves the visual dashboard against this project's compiled data, using the build bundled in the npm package.          |

### Tasks

| Command                                                                                                       | What it does                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `relay task new <title> [--source-type ticket\|issue\|adhoc] [--source-ref <ref>] [--baseline] [--tag <tag>]` | Creates a new `.bob/relay/tasks/T-NNN-<slug>/` directory + `task.json`. `--baseline` marks it as a manual (non-Relay) run for comparison. `--tag` is repeatable. |
| `relay task use <id>`                                                                                         | Sets the active task (writes `.bob/relay/.active`). Accepts the full id or the numeric prefix.                                                               |
| `relay task list [--tag <tag>]`                                                                               | Lists tasks, newest first; optionally filtered by tag.                                                                                                       |
| `relay task estimate [--task <id>] [--method ai-estimated --total-sec <n> [--per-stage <spec>] [--based-on <id>]]` | (Re)computes the estimated manual-completion baseline. With no `--method`, recomputes the automatic fallback tiers (historical average, then a hardcoded default). `--method ai-estimated` records the brief stage's LLM-produced estimate instead. |
| `relay task tag add <tags...> [--task <id>]`                                                                  | Adds one or more tags to a task (defaults to the active task).                                                                                               |
| `relay task tag remove <tags...> [--task <id>]`                                                               | Removes tags from a task.                                                                                                                                    |

### Stages

| Command                                                             | What it does                                                                                                                                                          |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `relay stage start <stage> [--task <id>] [--mode relay\|baseline]`  | Logs a `stage_start` event and marks the stage `running` in `task.json`.                                                                                              |
| `relay stage end <stage> [--task <id>] [--mode relay\|baseline]`    | Logs `stage_end`, marks the stage `done`, records its artifact path.                                                                                                  |
| `relay stage skip <stage> [--task <id>]`                            | Marks a stage `skipped` without running it.                                                                                                                           |
| `relay stage cancel <stage> [--task <id>] [--mode relay\|baseline]` | Cancels a running stage; restores from the pre-stage snapshot or marks it `failed`.                                                                                   |
| `relay stage manual <stage> [--task <id>] [--mode relay\|baseline] [--minutes <n>\|--started-at <iso>] [--completed-at <iso>]` | Records a stage as `done` after it was worked by hand without `stage start` — for backfilling timing on work that happened outside the CLI. |
| `relay recover [--yes]`                                             | Finds stages stuck `running` past the recovery timeout (`config.yml`, default 30m). `--yes` cancels/restores each one found; without it, it just reports them. |

`<stage>` is one of the nine `STAGES`: `onboard, brief, plan, implement,
debug, test, review, pr, docs`.

### Acceptance criteria

| Command                                                | What it does                                                                                                                                                        |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `relay criteria list [--task <id>]`                    | Lists acceptance criteria and their coverage state.                                                                                                                 |
| `relay criteria cover <id> --test <ref> [--task <id>]` | Marks a criterion `covered: true`, recording which test verifies it. **Only do this when a real test actually verifies it** — never to make coverage look complete. |
| `relay criteria uncover <id> [--task <id>]`            | Reverts a criterion to `covered: false` (the honest "amber" state).                                                                                                 |

### PR

| Command                                                     | What it does                                                                                                           |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `relay pr check-conflicts [--base <branch>] [--task <id>]`   | Dry-run merges the task's branch against a base branch (default `main` or `config.yml`'s `baseBranch`), reports conflicted files, and stores the result on the task. |

### Knowledge & metrics

| Command                                                           | What it does                                                                                                                                                                          |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `relay harvest <gotchaId> [--task <id>] [--mode relay\|baseline]` | Records that a knowledge entry (from `.bob/relay/knowledge/gotchas.md`) was harvested for the current task, closing the flywheel loop.                                                |
| `relay compile [--watch]`                                         | Compiles `.bob/relay/` into the dashboard's data file. `--watch` recompiles on any change under `.bob/relay/` (uses `fs.watch` recursive — see Troubleshooting for platform limits). |
| `relay report [--json] [--markdown] [--strict]`                   | Prints the baseline-vs-relay comparison. `--strict` exits non-zero if any comparison is incomplete (useful in CI).                                                                    |
| `relay status [--task <id>]`                                      | Prints the active task's summary (defaults to whatever `.bob/relay/.active` points at).                                                                                              |
| `relay doctor`                                                    | Sanity-checks `.bob/relay/` config against its own baton and the `gotchas.md` parser. Run this whenever something in the pipeline "doesn't feel wired up."                            |

## Bob IDE modes

`.bob/relay/custom_modes.yaml` defines one custom mode per Relay stage (plus
two stages that intentionally use Bob's own built-in modes). Each mode's
detailed behavior lives in `.bob/relay/rules-<slug>/`, loaded automatically
by Bob when that mode is active.

| Stage     | Mode                               | Built-in or custom | What it does                                                                                                                                        |
| --------- | ---------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| onboard   | `relay-onboard` (🧭 Relay Onboard) | custom             | Reads the knowledge base first, explores the codebase, writes architecture notes. Edit access limited to `.bob/relay/knowledge/` and `AGENTS.md`.   |
| brief     | `relay-brief` (📋 Relay Brief)     | custom             | Extracts acceptance criteria from a source ticket into `task.json`. Flags vague requirements instead of silently interpreting them.                 |
| plan      | Bob's built-in **Plan mode**       | built-in           | Produces `02-plan.md`, including rejected alternatives.                                                                                             |
| implement | Bob's built-in **Agent mode**      | built-in           | Writes the code; reads/writes `.bob/relay/` files directly.                                                                                          |
| debug     | `relay-debug` (🐛 Relay Debug)     | custom             | Root-causes a bug and harvests a gotcha into the knowledge base — a fix without a harvested gotcha is treated as an incomplete session.             |
| test      | `relay-test` (🧪 Relay Test)       | custom             | Writes one test per testable criterion and per debug note; marks coverage honestly (never marks something covered just because it was implemented). |
| review    | `relay-review` (🔍 Relay Review)   | custom             | Four distinct passes: plan conformance, criteria coverage, gotcha avoidance, conventions. Every finding needs a file:line and a suggested fix.      |
| pr        | `relay-pr` (🚀 Relay PR)           | custom             | Assembles the PR description entirely from files already written this task. Never opens the PR itself — that's a separate, user-confirmed step.     |
| docs      | `relay-docs` (📚 Relay Docs)       | custom             | Closes the flywheel: appends/cross-references the durable knowledge base. Never deletes or rewrites an existing entry.                              |

### Typical workflow inside Bob

1. `relay start "<title>"` — creates and activates the task, compiles, and
   opens the dashboard, all in one step (or `relay task use <id>` to switch
   to an existing task instead).
2. For each stage in order: switch Bob to that stage's mode →
   `relay stage start <stage>` → do the work (Bob writes the stage's owned
   artifact file, see table below) → `relay stage end <stage>` →
   `relay compile`.
3. If a CLI command fails mid-stage, report it and continue — don't abort
   the stage over a CLI hiccup.
4. Each stage only edits the files its mode's `groups.edit.fileRegex`
   allows, and only writes its own artifact — never another stage's.

### Stage → artifact mapping

| Stage     | Artifact file          | `task.json` fields it owns                                               |
| --------- | ---------------------- | -------------------------------------------------------------------------- |
| onboard   | *(none)*               | —                                                                          |
| brief     | `01-brief.md`          | `acceptanceCriteria`, `estimatedBaseline`                                  |
| plan      | `02-plan.md`           | —                                                                          |
| implement | `03-implementation.md` | `filesTouched`                                                             |
| debug     | `04-debug-notes.md`    | `knowledgeHarvested` (via `relay harvest`)                                 |
| test      | `05-tests.md`          | `acceptanceCriteria[].covered` / `.testRef` (via `relay criteria cover`)  |
| review    | `06-review.md`         | —                                                                          |
| pr        | `07-pr.md`             | —                                                                          |
| docs      | *(none)*               | —                                                                          |

The CLI, not Bob, owns `task.json`'s `stages.*` block — never edit it by
hand; use `relay stage start/end/skip/cancel/manual`.

### Skills

`.bob/relay/skills/` holds stage-specific workflows Bob can invoke: `doctor`,
`relay-baton` (reading/writing the baton files), `relay-criteria`
(acceptance-criteria extraction), `relay-harvest` (the exact gotcha template
`compile.ts`'s parser expects), `relay-create-pr`, and `relay-doctor` (wraps
`relay doctor`). `.bob/relay/commands/` exposes some of these as Bob slash
commands.

## Built with IBM Bob 2.0

Relay is built using, and built _for_, Bob:

- **Agent mode** - drives `implement` and `debug`, reading/writing
  `.bob/relay/` files directly.
- **Plan mode** - produces `02-plan.md`, including rejected alternatives, so
  that context doesn't die before review.
- **Custom modes** - one per pipeline stage, each scoped to read the right
  `.bob/relay/` inputs and write the right stage artifact.
- **Rules** - enforce the baton contract: every stage must read prior
  context and write its artifact before advancing.
- **Skills** - stage-specific workflows: acceptance-criteria extraction,
  knowledge harvesting, multi-angle review.
- **Subagents** - parallel review passes (plan-conformance, criteria
  coverage, gotcha-avoidance, convention-checking) and parallel onboarding
  reads.
- **Document understanding** - extracting acceptance criteria directly from
  source tickets/PDFs during `brief`.

## Troubleshooting

Run `relay doctor` first — it runs all of the checks below in one shot and
tells you exactly what's broken and (where possible) how to fix it.

| Symptom                                                       | Likely cause                                                                                                                                                                                                                                                                                          | Fix                                                                                                                                                                                                                             |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `relay: command not found` / `npx relay` fails                | Not installed globally, and `bob-relay` isn't a local dependency yet — `npx relay` then resolves an unrelated `relay` package from the registry instead of this one                                                                                                                                  | `npm install -g bob-relay` (or `npm install --save-dev bob-relay` in the project), then plain `relay <command>` works. In this monorepo specifically: `npm run build --workspace cli`, or call `node cli/dist/index.js <command>` directly. |
| `MODULE_NOT_FOUND` running a script                           | Wrong invocation path/cwd                                                                                                                                                                                                                                                                             | Run from the repo root, not a subdirectory, unless the doc you're following says otherwise.                                                                                                                                     |
| A stage's mode "isn't wired up" in Bob                        | `custom_modes.yaml` missing the slug, or no matching `.bob/relay/rules-<slug>/` directory                                                                                                                                                                                                              | `relay doctor`'s "every stage has a mode or rules file" check reports the exact stage/mode pair; add the missing mode entry or rules directory.                                                                                 |
| A rule/skill references a file that doesn't exist             | Stale path in a `.bob/relay/` Markdown file                                                                                                                                                                                                                                                            | `relay doctor`'s "every referenced path exists or is stage-created" check lists the bad reference and the file it's in.                                                                                                         |
| `relay status`/stage commands act on the wrong task           | `.bob/relay/.active` is empty, stale, or doesn't match any task directory                                                                                                                                                                                                                              | `relay doctor`'s "`.bob/relay/.active` resolves" check confirms this; fix with `relay task use <id>`.                                                                                                                            |
| Bob can't see `.bob/relay/` files at all                      | `.bobignore` excludes `.bob/relay/`                                                                                                                                                                                                                                                                     | `relay doctor`'s "`.bobignore` does not exclude `.bob/relay/`" check catches this — remove the excluding rule. `.bob/relay/` must never be gitignored or bobignored; it's the product.                                          |
| A harvested gotcha never shows up in `relay compile`'s output | `gotchas.md` entry doesn't match the exact format `compile.ts`'s parser expects (`## gotcha-NNN - Title` heading, then `- **field:** value` bullets in exact order, including `discoveredIn`, `discoveredAt`, `costMinutes`, `symptom`, `rootCause`, `fix`, `watchOut`, `codeRefs`, `stalenessCheck`) | `relay doctor`'s "gotcha format matches compile.ts parser" check names the missing field; activate the `relay-harvest` skill for the exact template rather than hand-writing the entry.                                         |
| A stage is stuck showing `running` forever                    | A Bob session crashed/was killed mid-stage                                                                                                                                                                                                                                                             | `relay recover` lists any stage running past the timeout (`config.yml`, default 30m); `relay recover --yes` cancels/restores it. `relay doctor` also flags this.                                                                |
| Dashboard shows stale or missing data                         | The compiled data file wasn't recompiled, or its `schemaVersion` is out of date                                                                                                                                                                                                                        | Run `relay compile`. `relay doctor`'s last check verifies the file exists and its `schemaVersion` matches `cli/src/types.ts`'s `SCHEMA_VERSION`.                                                                                |
| `relay compile --watch` doesn't pick up changes               | `fs.watch({recursive:true})` only works on win32/darwin, not Linux                                                                                                                                                                                                                                      | On Linux, run `relay compile` manually after edits, or add `chokidar` (see the comment in `cli/src/compile.ts`).                                                                                                                |
| An acceptance criterion looks "done" but is marked uncovered  | This is by design                                                                                                                                                                                                                                                                                       | `covered` must only be `true` when a real test verifies it — an honest amber (`testable:true, covered:false`) is a correct, expected state, not a bug. Don't force it to `true`; write the test and use `relay criteria cover`. |
| CI wants a single pass/fail signal for baseline vs. Relay     | Default `relay report` output is informational only                                                                                                                                                                                                                                                    | Use `relay report --strict` to exit non-zero if any comparison is incomplete, and `--json`/`--markdown` for machine/PR-friendly output.                                                                                         |

## Status

Working npm package (`bob-relay`) with a full CLI, Bob IDE integration, and a
bundled visual dashboard. See `docs/demo-script.md` for a guided walkthrough
and `bob-sessions/` for the required Bob session screenshots.
