# Bob config (human-facing - Bob does not load this file, see `.bobignore`)

Sprint 4: Relay's Bob IDE configuration. See `.bob/FORMAT-NOTES.md` for the
exact schema each file below relies on, and every doc URL/decision it came
from.

## Layout

```
.bob/
  custom_modes.yaml        # relay-onboard, relay-brief, relay-debug,
                            # relay-test, relay-review, relay-pr, relay-docs
  rules/relay-core.md      # global rule, every mode
  rules-relay-<stage>/     # per-custom-mode instructions
  rules-plan/, rules-agent/  # attach Relay rules to built-in Plan/Agent modes
  skills/relay-baton/      # file conventions, task.json fields, CLI commands
  skills/relay-criteria/   # acceptance-criteria extraction + ambiguity rewrites
  skills/relay-harvest/    # exact gotchas.md entry format
```

## Stage → mode

| stage     | mode                        |
| --------- | --------------------------- |
| onboard   | custom mode `relay-onboard` |
| brief     | custom mode `relay-brief`   |
| plan      | built-in **Plan** mode      |
| implement | built-in **Agent** mode     |
| debug     | custom mode `relay-debug`   |
| test      | custom mode `relay-test`    |
| review    | custom mode `relay-review`  |
| pr        | custom mode `relay-pr`      |
| docs      | custom mode `relay-docs`    |

## Auto-approve allowlist (set manually in Bob Settings → Auto-Approve)

Every stage's rules run these; approving them once removes a prompt per
stage instead of per command:

```
npx relay stage start *
npx relay stage end *
npx relay compile
npx relay harvest *
npx relay criteria cover *
npx relay criteria list
npx relay status
```

This is guidance only - Bob's auto-approve list lives in its own settings,
not a file this config writes for you.

## Pre-run checklist (also in `docs/bob-runbook.md`)

1. Hackathon Bob account selected in Bob settings (not your personal one).
2. `npx relay task new "<title>"` run for the task.
3. `.relay/.active` points at that task.
4. Dashboard running (`npm run dev:dashboard`) - it builds the CLI and
   starts `relay compile --watch` automatically, no second terminal needed.

## Why review and pr are custom modes, not built-in workflows

Bob's built-in `/review` and PR-generation workflows have no documented way
to attach custom rules or read an arbitrary markdown file as input - see
`FORMAT-NOTES.md`. `relay-review` and `relay-pr` are thin custom modes that
produce the right baton artifact; `relay-pr` then tells you to run the
custom `/relay-create-pr` command (`.bob/commands/relay-create-pr.md`),
which opens the PR with `07-pr.md` used verbatim as the body via the `gh`
CLI, falling back to Bob's own `/create-pull-request` (and syncing its
generated text back into `07-pr.md`) only if `gh` isn't available.
