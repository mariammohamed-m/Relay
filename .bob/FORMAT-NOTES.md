# Bob format notes (Sprint 4)

Source of truth for every schema key used in `.bob/`. Read before editing any
config file here. Bob does not load this file (see `.bobignore`) - it's for
humans and for future edits.

## Verified against https://bob.ibm.com/docs/ide/... (fetched 2026-09-24)

**Custom modes** - `custom-modes` doc.

- File: `.bob/custom_modes.yaml` (project-scoped) or `~/.bob/settings/custom_modes.yaml` (global).
- Top-level key: `customModes:` (array).
- Mode object keys: `slug`, `name`, `description`, `roleDefinition`,
  `whenToUse`, `customInstructions`, `groups`, `allowedSubagents`.
- `groups` values: `read`, `edit`, `execute`, `mcp`, `skill`, `workflow`,
  `todo`, `subtask`, `subagent`, `mode`.
- File-restricted edit: nested-array form -
  `- - edit` / `  - fileRegex: "..."` / `    description: "..."`.
- Built-in mode slugs: `agent`, `ask`, `plan` (confirmed by both the
  `custom-modes` and `modes` docs - there is no separate "code" mode; Agent
  mode is the implement/code mode).

**Rules** - `rules` doc.

- Global: `~/.bob/rules/` (or `%USERPROFILE%\.bob\rules\` on Windows).
- Workspace, all modes: `.bob/rules/*` (any filename, loaded alphabetically).
- Mode-scoped: `.bob/rules-{mode-slug}/*`, e.g. `.bob/rules-agent/`,
  `.bob/rules-plan/`, `.bob/rules-relay-debug/`.
- No frontmatter required. Mode-specific rules load before general/global
  rules; workspace overrides global.
- Consequence for this repo: `rules-agent/` and `rules-plan/` apply to
  **every** use of Bob's built-in Agent/Plan modes in this workspace, not
  only Relay's `implement`/`plan` stages. Acceptable here since the repo is
  single-purpose for the hackathon; flagged so it isn't assumed generic.

**Skills** - `skills` doc.

- Layout: `.bob/skills/<skill-name>/SKILL.md` (+ optional supporting files
  in the same folder/subfolders). Global equivalent: `~/.bob/skills/`.
- Required frontmatter: `name`, `description` (a skill with no `description`
  is never activated).
- Activation is automatic, based on matching the user's request against
  `description` - **UNVERIFIED: there is no documented way for a rules file
  to force-invoke a specific skill by name.** Rules in this repo reference
  skills by name in prose ("see the relay-baton skill") and rely on Bob's
  automatic matching plus the skill's own description being specific enough
  to trigger during a Relay stage. Treat every "skill invoked from a rule"
  claim in this repo as best-effort, not guaranteed.

**Subagents** - `subagents` doc.

- Two types: `explore` (read-only, lighter model), `general` (full tools,
  default model).
- Enabled per-mode via the `subagent` tool group (`groups: [subagent, ...]`);
  `allowedSubagents` can restrict which types.
- **UNVERIFIED: no documented syntax for a rules file to trigger a subagent
  spawn, or to spawn several in parallel.** The docs only confirm the
  _capability_ exists per-mode and that parallel subagents render in one
  collapsible panel. Every "spawn a subagent per X" instruction in this
  repo's rules is written as an instruction to Bob in prose (matching how
  Bob's own tutorial examples phrase it), not as verified config syntax -
  marked UNVERIFIED in `onboard.md` and `review.md` headers.

**Modes** - `modes` doc. Built-ins: Agent (implement), Plan (design), Ask
(Q&A). Confirms the `custom-modes` slugs above.

**`.bobignore`** - `bobignore` doc.

- File: `.bobignore` at workspace root, `.gitignore` syntax.
- Enforced on `read_file`/`write_file`/`apply_diff`/`GetSymbolsOverview`;
  **documented gap**: `insert_content`/`search_and_replace` may bypass it.
- Does not document whether it affects rules/skills loading - assumed no
  (rules/skills load from `.bob/` regardless), since ignoring `.bob/` itself
  would break the config.
- `@file`/`@folder` context mentions **bypass `.bobignore` entirely** - so
  excluding `cli/`/`dashboard/` from Bob's ambient view doesn't stop a rule
  from explicitly `@`-mentioning one file inside them when needed.

**Context mentions** - `context-mentions` doc.

- `@/path/from/workspace/root` (leading slash, no `.relay/...` prefix style
  shown in the docs - but the project's own README already uses
  `@.relay/...`-style mentions, and the doc's own repo-root convention
  is compatible with that relative form in practice). Rules in this repo use
  `@.relay/...` to match the README's established convention; if Bob
  requires the literal `@/`-from-root form instead, prefix each mention with
  `/` - **UNVERIFIED which exact form Bob's mention parser accepts**, since
  the docs example uses `@/path` and the repo's own docs use `@.relay/path`.
  Flagging rather than guessing.
- `@terminal` - last command + output. `@problems` - Problems panel
  diagnostics. `@git-changes` - working tree diff.

**Code reviews** - `code-reviews` doc.

- Triggered via `/review` command or Review panel. Branch/diff comparison,
  uncommitted-changes toggle, exclusion globs, optional GitHub issue link.
- **No documented mechanism for custom rules to attach to this workflow.**
  Decision: `review` stage uses a custom mode (`relay-review`), not the
  built-in review workflow, per the user's own fallback instruction.

**Pull requests** - `pull-requests` doc.

- Triggered via Source Control panel PR icon, command palette
  "Bob: Create Pull Request", or `/create-pull-request` in chat.
- Generates title/description from branch diff, commits, and branch name;
  checks for a PR template at 6 standard paths. **Does not document reading
  an arbitrary markdown file as the description source.**
  Decision: `pr` stage uses a custom mode (`relay-pr`) to assemble
  `07-pr.md`, then a custom command, `/relay-create-pr`
  (`.bob/commands/relay-create-pr.md`), opens the PR itself via the `gh`
  CLI with `07-pr.md`'s content used verbatim as the body - guaranteed,
  since it never goes through Bob's diff-based generator. It falls back to
  Bob's built-in `/create-pull-request` (syncing whatever Bob actually
  generated back into `07-pr.md` afterward) only if `gh` isn't
  installed/authenticated. `.bob/commands/*.md` files are plain prompt
  macros (frontmatter `description` + a natural-language body run by
  whichever mode is active), same shape as the existing `relay-doctor`
  command - not a separate scripting mechanism.

**Add-bob-capabilities tutorial** - confirms `.bob/custom_modes.yaml`
location and the mode-creation flow (via Settings UI, which then writes the
YAML); no additional schema keys beyond `custom-modes` doc.

## Stage → mode mapping actually used (see also `.bob/README.md`)

| stage     | mode                                   | why                                                                                              |
| --------- | -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| onboard   | custom `relay-onboard`                 | per spec                                                                                         |
| brief     | custom `relay-brief`                   | per spec                                                                                         |
| plan      | built-in `plan` + `.bob/rules-plan/`   | rules docs confirm mode-scoped rules dirs                                                        |
| implement | built-in `agent` + `.bob/rules-agent/` | "Agent mode" is Bob's code/implement mode; no separate "code" slug exists                        |
| debug     | custom `relay-debug`                   | per spec                                                                                         |
| test      | custom `relay-test`                    | per spec                                                                                         |
| review    | custom `relay-review`                  | built-in review workflow has no documented rule-attachment point                                 |
| pr        | custom `relay-pr`                      | built-in PR generation has no documented file-input point; hands off after assembling `07-pr.md` |
| docs      | custom `relay-docs`                    | per spec                                                                                         |

## Nothing was invented

Every YAML key, tool-group name, directory path, and mode slug above appears
verbatim in a fetched doc. Where a doc did not answer a question the spec
asked for (subagent spawn syntax, skill force-invocation, exact `@`-mention
root form), it is marked UNVERIFIED above and in the affected file's header
comment rather than guessed.
