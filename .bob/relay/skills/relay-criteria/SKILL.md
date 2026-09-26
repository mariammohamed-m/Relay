---
name: relay-criteria
description: How to extract testable acceptance criteria from a ticket and write ambiguity rewrites. Use during the Relay brief stage, whenever turning ticket language into task.json's acceptanceCriteria.
---

# Extracting acceptance criteria

Each criterion is an `AcceptanceCriterion` (`cli/src/types.ts`): `id`
(`AC-1..n`), `text`, `source` (exact ticket location), `testable`,
`ambiguityNote` (non-null only when `testable: false`), `covered` (always
`false` at brief time), `testRef` (always `null` at brief time).

**Good (testable as written):**

> "Refund requests submitted within 30 days of purchase are approved."
> → `testable: true`, `ambiguityNote: null`. Concrete bound (30 days), clear
> pass/fail condition.

**Bad (needs a rewrite):**

> "Refunds should be handled promptly."
> → `testable: false`. `ambiguityNote`: propose a measurable rewrite -
> "Refund approval or rejection decisions are communicated to the requester
> within 2 business days of the request" - derived from context elsewhere in
> the ticket (an SLA number, a related bullet), never invented from nothing.
> If the ticket gives no basis for a number, say so in `01-brief.md` and flag
> it for the user to supply one; don't guess a bound.

Never mark a requirement `testable: true` just because it's short or
sounds concrete - check it actually has a measurable pass/fail condition.
