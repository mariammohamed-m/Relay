---
name: relay-harvest
description: The exact gotchas.md entry format the compile.ts parser expects. Use during the Relay debug stage whenever writing a new entry to .relay/knowledge/gotchas.md - a heading or field off this format silently fails to compile.
---

# Gotcha entry format

`cli/src/knowledge.ts`'s `parseGotchas` splits on `^## ` headings and reads
`- **field:** value` bullets below each one. Field labels are matched
case/space-insensitively, but use this exact casing for consistency with
existing entries.

**Heading:** `## gotcha-NNN - Title` (next free number; em dash `-`,
not a hyphen).

**Required fields, in order, each a `- **field:**` bullet** (multi-line
values may wrap on indented continuation lines):

```markdown
## gotcha-022 - Short, specific title of the bug class

- **discoveredIn:** T-NNN-slug
- **discoveredAt:** 2026-09-26T10:44:00Z
- **costMinutes:** 35
- **symptom:** What was observed before the cause was known.
- **rootCause:** What actually caused it.
- **fix:** How it was fixed.
- **watchOut:** One-line warning surfaced during future onboarding.
- **codeRefs:** `path/to/file.ts:NN`, `path/to/other.ts:NN`
- **stalenessCheck:** When this entry should be re-verified.
```

`costMinutes` must be a bare number (the parser regexes the first digits
out of the value). `codeRefs` is comma-separated, backticks optional (the
parser strips them). Append new entries at the end of the file - never
edit or delete an existing entry, even to fix a typo; add a follow-up note
in a new entry instead.
