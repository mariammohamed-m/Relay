---
description: Open the PR for the active Relay task using 07-pr.md verbatim as the body, instead of Bob's diff-generated description.
---

Bob's built-in `/create-pull-request` generates its description from the
branch diff/commits/branch name and doesn't read an arbitrary file - see
`.bob/FORMAT-NOTES.md`. This command exists to make `07-pr.md` the actual
PR body, not just something you paste in by hand.

**Steps:**

1. Resolve the active task from `.bob/.active` - never hardcode it.
2. Read `.bob/tasks/<task-id>/07-pr.md` in full. This is the PR
   description, verbatim - do not rewrite, summarize, shorten, or
   "improve" it. If it doesn't exist yet, stop and say the `pr` stage
   hasn't been run.
3. Derive the PR title from the file's `# PR - <title>` heading (strip the
   `# PR - ` prefix) or from `task.json`'s title field - not from the diff.
4. Check the branch is pushed (`git status`). If it isn't, or this is the
   first push of the branch, confirm with the user before pushing -
   creating/pushing a PR is a visible, shared-state action, per this
   repo's own action-confirmation norms. Never force-push.
5. **If the `gh` CLI is installed and authenticated** (`gh auth status`):
   create the PR with the file's content used exactly as the body, no
   intermediate rewriting step:
   ```
   gh pr create --title "<title from step 3>" --body-file .bob/tasks/<task-id>/07-pr.md
   ```
   Confirm with the user before running this - it opens a real PR visible
   to collaborators. Report the PR URL back when done.
6. **If `gh` isn't available/authenticated**, fall back to Bob's built-in
   `/create-pull-request` and let it generate its own description. Once
   the PR is open, overwrite `.bob/tasks/<task-id>/07-pr.md` with
   whatever title+description Bob actually used, so the artifact stays an
   honest record of what was actually published rather than what was
   drafted. Tell the user you fell back and why.

**Does not run any `relay stage` commands** - the `pr` stage's own
`stage start`/`stage end`/`compile` already happened when `07-pr.md` was
written; this command only submits it.
