# Relay dashboard - design system

Extracted from the Magic Patterns mockup (`test.txt`, a `commandCenter` /
`timelineInspector` / `handoffReport` set of layout concepts for a fictional
tool with the same shape as Relay). Every token below is read directly off
that mockup's `index.css`, `tailwind.config.js`, and component classNames -
see `dashboard/src/styles/tokens.css` for the machine-readable form. Every
component in this app consumes those tokens; nothing is hardcoded.

## Color

A dark-only surface stack - the mockup has no light theme, no
`prefers-color-scheme` handling, and no theme toggle anywhere in it. That's
a deliberate choice for a tool meant to be read on a dev's second monitor
during a live coding session, and this dashboard keeps it dark-only rather
than inventing a light mode the mockup never specified.

Four-step surface ramp, each step a small lightness increase over the last:
`canvas` (page background, near-black) → `surface` (panels) → `raised`
(hover/active state on a panel) → `line` / `line-strong` (borders, in
increasing emphasis). Text has its own three-step ramp: `fg` (primary),
`muted` (secondary), `subtle` (meta/caption, the dimmest legible tone).

Three semantic accents, used sparingly and consistently:

- **accent** (blue) - running/active/interactive-selected. The _only_ color
  used for "this is happening now" or "this is selected."
- **ok** (green) - done / covered.
- **warn** (amber) - needs a human decision: an untestable criterion, a
  flagged ambiguity, a warning line in stage output.

`bad` (red) is defined in the mockup's palette; the mockup itself never
renders it, but this dashboard now does in two places, both genuine
failures rather than an "uncovered" or "pending" state: the crash-avoidance
empty states (malformed JSON, missing file), and a stage's `failed` status
on the JourneyRail (a cancelled run with no snapshot to restore) - shown as
a filled circle with an X glyph, same shape language as `done`'s check but
red instead of green, so it reads even without color.

**The load-bearing rule, and the one place this dashboard diverges hardest
from generic dashboard conventions:** an uncovered acceptance criterion is
never red. Relay's product thesis is that "uncovered" is an honest,
expected state - so it renders in `muted` gray, the same tone as any other
secondary text, not as an alarm. Only `warn` (untestable/ambiguous) and the
covered/uncovered split get distinct treatment; failure-red is reserved
for things that are actually broken (the dashboard's own error states),
never for a criterion simply not having a test yet.

## Typography

- **Sans** - IBM Plex Sans (400/500/600), the body and UI face throughout.
- **Mono** - IBM Plex Mono (400/500), reserved for anything that's an
  identifier or a measurement: task/stage ids, criterion ids, gotcha ids,
  durations, timestamps, file paths, branch names, token counts. If a
  human wrote it, it's sans; if it's a machine-legible token, it's mono.

Full type scale, smallest to largest (see `--fs-*` tokens): a 10px
micro-scale for axis ticks, 11px for meta text, 12px for labels/tabs,
12.5px monospace for stage-output bodies, 14px base body, 18px section
headings, 24px for a first-class stat number, 30px for a page-level hero
title. Weight does most of the emphasis work - 500 (medium) for anything
"selected" or "labeled," 600 (semibold) for headings and big numbers -
rather than size jumps.

## Spacing & rhythm

4px base unit (Tailwind's default scale). Panel interior padding is
20px (`--space-5`); gaps between related inline elements are 8–12px;
gaps between major page sections are 20px, except the single-column
report layout, which opens sections out to 56px (`--space-14`) since it
has no side-by-side density constraint.

## Radii

Three steps: 4px for small inline chips, 6px for interactive controls
(buttons, journey nodes, output containers), 8px for panels and
dropdowns. Anything that's a dot, pill, bar, or progress segment is
fully rounded.

## Borders & dividers

Everything is defined by a 1px hairline border (`line`) rather than by
elevation - panels, output boxes, the header's bottom edge, table-style
list rows (`divide-y divide-line`) all use the same border color at the
same weight. Two special border treatments carry meaning on their own:

- **dashed** border = "not applicable yet / not real" - used for the
  `skipped` stage icon and for `pending` blocks in the timeline weight
  view. Solid means "this happened," dashed means "this didn't (yet)."
- **stronger border** (`line-strong`) = a baseline / reference value
  that isn't the live number - e.g. the manual-baseline bar underneath
  the relay bar in the impact comparison.

## Elevation

The mockup is almost entirely flat. Exactly one thing in it gets a
shadow: the task-switcher dropdown, the only floating/overlay surface
in the whole mockup. That's the rule this dashboard follows - elevation
is reserved for things that float above the page (dropdowns, the
JourneyRail slide-over), never applied to panels sitting in normal flow.

## Status encoding

Status is never carried by color alone - shape and motion double it up
so it reads even without color:

- **done** - filled circle, ok-green, checkmark glyph.
- **running** - two overlaid rings: a dim static accent ring plus a
  spinning accent arc on top (`motion-safe:animate-spin`).
- **skipped** - dashed circle outline, subtle gray, minus glyph.
- **pending** - plain hollow circle, `line-strong` outline, no glyph.
- **failed** - filled circle, `bad`-red, X glyph. Not clickable as an
  artifact; clicking opens a small dialog with the failure reason and the
  recovery instruction, and the reason is also on the node's hover/focus
  title so it's discoverable without a click.

The same status vocabulary is reused everywhere a lifecycle needs
showing (stage nodes, criteria coverage segments, task-switcher stage
strips) rather than inventing a second status language per component.

## Component anatomy

- **Panel** - the base card: `rounded-lg border border-line bg-surface`,
  20px padding, a header row (title left, small meta right) 16px above
  the content.
- **List row** - `divide-y divide-line`, ~10px vertical padding per row,
  a leading icon/glyph, then a two-line content block (primary line +
  meta line in `subtle` mono).
- **Segmented progress bar** - one flush-rounded segment per item
  (criterion, stage), not a single continuous fill. This is specifically
  how "N of M" coverage is drawn, and it's reused as-is for
  CriteriaCoverage's header metric.
- **Node button** (JourneyRail's pattern, from the mockup's journey
  strip) - vertical stack of status glyph → label → duration, active
  state = raised background + a thin accent bar along the bottom edge.
- **Floating overlay** (tasks sheet / artifact dialog) - `rounded-lg
border-line bg-surface`, the one place shadow appears. The tasks sheet
  slides in from an edge (fade + translate); the artifact dialog is
  centered instead (fade + slight scale), since it's a focused single-item
  view rather than a list to browse alongside the page.
- **Paired bar** (mockup's ImpactBars) - two stacked 6px bars per row:
  a `line-strong` reference bar (baseline) behind a shorter `accent`
  bar (measured relay time), with a mono "baseline → relay" readout on
  the right. This dashboard's ImpactPanel reuses this exact pattern.

## Animation & transitions

- Hover/press: plain 150ms color transition, no easing tricks.
- Content swap (switching the selected stage, switching tabs): 140–160ms
  fade with a 4px vertical slide, eased with `cubic-bezier(0.23,1,0.32,1)`
  (a fast-out-slow-in "ease-out-expo" feel - snappy start, soft landing).
- Expand/collapse (accordion rows): 220ms height+opacity, same easing.
- "Live" states (a running spinner, a running progress fill, a running
  status dot) pulse or spin continuously via `motion-safe:animate-*`,
  which respects `prefers-reduced-motion` automatically.

## Dark/light handling

Dark-only, by mockup design - see **Color** above. Not carried over as a
gap; carried over as the intended, considered choice it is.

## Deriving components the mockup has no pattern for

Relay needs two panels (BatonPanel, and CriteriaCoverage's
untestable-criterion detail) that don't map onto any single mockup
component one-to-one. Both are built out of the vocabulary above rather
than a new visual idiom: BatonPanel is a `Panel` containing the mockup's
list-row pattern (used by `ContextPanel` for context files) - grouped
by kind. The untestable-criterion state reuses `CriteriaList`'s existing
third `vague` treatment (amber, `AlertTriangle` glyph, note line in
place of a test ref) which already exists in the mockup for exactly this
purpose.
