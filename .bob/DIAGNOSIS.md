# Diagnosis: relay-\* custom modes absent from Bob's mode selector

Re-verified 2026-09-25 against fresh fetches of:

- https://bob.ibm.com/docs/ide/configuration/custom-modes (full page reproduced verbatim)
- https://bob.ibm.com/docs/ide/features/modes (confirms built-in slugs `agent`/`ask`/`plan`; defers all custom-mode schema detail to the page above)

Sprint 4's `FORMAT-NOTES.md` claims were re-checked line by line against the fresh fetch, not assumed. Result below.

## What the docs actually require

| Check                       | Docs say                                                                                                                                                                                                                                            |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. File location/structure  | Single file, not folder-per-mode. Project: `.bob/custom_modes.yaml`. Global: `~/.bob/settings/custom_modes.yaml`. (Folder structure - `.bob/rules-{slug}/` - is only for _mode-specific instructions_, a separate concept from mode _definitions_.) |
| 2. Extension/format         | `.yaml`, top-level key `customModes:` (array). Legacy `.json` still supported but not preferred.                                                                                                                                                    |
| 3. Required fields          | **Required:** `slug`, `name`, `roleDefinition`. **Optional:** `description`, `whenToUse`, `customInstructions`, `groups`, `allowedSubagents`. If `groups` is omitted the mode loads but gets no tools - not our case.                               |
| 4. Naming constraints       | `slug` must use only letters, numbers, hyphens; must be unique across modes (duplicates "can prevent modes from loading correctly").                                                                                                                |
| 5. Global vs project        | No manifest/index needed - a mode in `.bob/custom_modes.yaml` loads automatically. Project overrides > global overrides > built-in defaults when slugs collide.                                                                                     |
| Bonus, found in fresh fetch | "Invalid `fileRegex` values can prevent the mode file from loading" and "unknown group names do not grant access" - both are per-file failure modes worth checking explicitly.                                                                      |

The doc's own complete example (`docs-writer`) uses exactly the nested `- - edit` / `- fileRegex:` / `description:` shape already in this repo's file - confirmed byte-for-byte against the fetch, not from memory.

## What exists on disk, checked per mode

All 7 relay-\* modes live as entries in the single array in `.bob/custom_modes.yaml` (no folder-per-mode, no separate files). Checked each individually:

| slug            | required fields present     | slug valid+unique | groups valid                                       | fileRegex (if any) valid        |
| --------------- | --------------------------- | ----------------- | -------------------------------------------------- | ------------------------------- | ---------------------- | ------------------- |
| `relay-onboard` | ✅ slug/name/roleDefinition | ✅                | ✅ read, execute, subagent, skill, restricted edit | ✅ `^\.relay/knowledge/.\*      | ^AGENTS\.md$` compiles |
| `relay-brief`   | ✅                          | ✅                | ✅ read, execute, skill, restricted edit           | ✅ `^\.relay/tasks/.*` compiles |
| `relay-debug`   | ✅                          | ✅                | ✅ read, edit, execute, skill                      | n/a (unrestricted edit)         |
| `relay-test`    | ✅                          | ✅                | ✅ read, edit, execute, skill                      | n/a                             |
| `relay-review`  | ✅                          | ✅                | ✅ read, execute, subagent, skill, restricted edit | ✅ `^\.relay/tasks/.*` compiles |
| `relay-pr`      | ✅                          | ✅                | ✅ read, execute, skill, restricted edit           | ✅ `^\.relay/tasks/.*` compiles |
| `relay-docs`    | ✅                          | ✅                | ✅ read, execute, skill, restricted edit           | ✅ `^\.relay/.\*                | ^AGENTS\.md$           | ^docs/.\*` compiles |

Also verified mechanically (not by inspection alone):

- File parses cleanly as YAML (`yaml.safe_load`) with no errors.
- All 7 slugs are unique and match `^[a-zA-Z0-9-]+$`; none collide with built-in `agent`/`ask`/`plan`.
- Every `fileRegex` string compiles as a valid regex (checked with `new RegExp(...)`).
- No BOM, no CRLF, no tab characters, no zero-width/non-breaking-space characters anywhere in the file.
- Only one `custom_modes.yaml` exists in the repo (no stray legacy `.json` competing with it, no duplicate file).
- No global `~/.bob/settings/custom_modes.yaml` on this machine that could collide with or shadow the project slugs.

## Mismatch found

**None.** Every check the task asked me to rule in/out - file location, extension, required fields, naming, global/project registration - comes back matching the docs exactly, for all 7 modes individually. Sprint 4's original implementation was already correct against the verified spec; nothing here needed changing.

One piece of harmless cruft, not a cause: `.bob/modes/` is a leftover empty directory (just `.gitkeep`) that predates `custom_modes.yaml`. Bob never reads it - mode _definitions_ only come from `.bob/custom_modes.yaml`; `.bob/rules-{slug}/` folders are a different thing (instructions, not definitions). Left in place since removing it isn't part of a mode-file fix, but flagging it so it isn't mistaken for a second mode-loading mechanism during future debugging.

## What was added

Since no defect was found to fix in the 7 relay-\* modes, added one isolation probe: `relay-test-minimal`, appended to `.bob/custom_modes.yaml`, containing only the three fields the docs mark required, worded as closely as possible to the docs' own example:

```yaml
- slug: relay-test-minimal
  name: Relay Test Minimal
  roleDefinition: You are a minimal test mode used to verify custom mode loading.
```

**If `relay-test-minimal` does not appear in the mode selector either**, the problem is not in any mode file's content - it's almost certainly outside what a static file check can see (stale IDE mode-list cache needing a window reload, a Bob version on this machine that doesn't yet support project-level custom modes, an extension-level setting, or a workspace-trust prompt). That would need to be checked live in the IDE, not by re-editing YAML.

**If it does appear**, but the relay-\* modes still don't, that would contradict every check above and should be reported back with the exact error (if any) Bob's mode picker or output panel shows - this repo's file was not able to reproduce a defect for it to react to.
