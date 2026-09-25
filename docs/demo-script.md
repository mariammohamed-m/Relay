# Demo script

A 3-minute beat sheet. At real speed, a full T-000 journey takes about 2.5
hours (see the mock fixture's own stage durations) - this video is
necessarily a heavily time-lapsed edit, not a real-time recording. Beats
marked **(sped up)** should be shown as fast-forwarded screen capture with
voiceover, not real-time footage; beats without that marker are the ones
worth slowing down for or cutting to full speed.

Prompts below are quoted verbatim from `docs/bob-runbook.md` - if a prompt
needs to change for the recording, change it there first so the two stay in
sync.

## The mock vs. the live knowledge base - read this before recording

`.relay/tasks/T-000-refund-window/` (the mock) is a complete, pre-written
"what a successful run looks like" reference - its own artifacts narrate
`gotcha-014` as something it already harvested. The **live** knowledge base
(`.relay/knowledge/gotchas.md`) starts every rehearsal _without_
`gotcha-014` in it - `scripts/demo-reset.mjs` strips it out specifically so
a live run can genuinely harvest it fresh, live, on camera. This means:
right after a reset, if you fall back to showing the T-000 mock in the
dashboard, its KnowledgeFeed panel won't show a `gotcha-014` row (the global
knowledge list won't have one yet) even though T-000's own BatonPanel still
says it harvested one - that's expected, not a bug. If you land in that
state, narrate from T-000's `04-debug-notes.md` slide-over instead (open via
JourneyRail - the full story is embedded in the artifact text regardless of
what the global knowledge list contains) rather than pointing at the
KnowledgeFeed panel.

## Recording checklist

- **Screen resolution:** 1920×1080, dashboard browser window sized to
  exactly 1440px wide (the width JourneyRail is designed to fit all 9
  stages without scrolling - see `dashboard/DESIGN.md`).
- **Dashboard zoom:** 100% (no browser zoom) - the type scale is already
  tuned for this width.
- **Terminal font size:** large enough to read at 1080p on a laptop
  screen when the recording is scaled down - 16–18pt is usually right.
- **Hide notifications:** OS notifications, Slack/email badges, and any
  IDE "update available" banners off before recording. Close unrelated
  browser tabs - the task switcher dropdown should only ever show T-000
  and whatever live task is running.
- **Before every take:** `node scripts/demo-reset.mjs --yes` then
  `node scripts/demo-check.mjs` - don't record on an unverified state.
- **`npm run dev:dashboard`** running in a visible terminal pane
  throughout - it now builds the CLI and starts `relay compile --watch`
  automatically, so the dashboard updates live as stages complete with no
  second terminal needed.

## Beat sheet

### 0:00–0:15 - The pain (cold open)

- **On screen:** talking head or a static slide, not the dashboard yet.
- **Bob mode:** none.
- **Dashboard:** not shown yet.
- **Voiceover:** "Every AI coding assistant starts from zero. The
  implementer doesn't know what the plan was. The reviewer doesn't know why
  approach A beat approach B. And the bug someone already found last month
  gets rediscovered, from scratch, by someone else. That's not a tooling
  gap - nothing measures it, and nothing carries it forward."
- **Fallback:** none needed - this beat has no live component.

### 0:15–0:30 - Onboard **(sped up)**

- **On screen:** terminal running the onboard prompt; cut to dashboard
  JourneyRail with the `onboard` node running (spinner), then done.
- **Bob mode:** `relay-onboard`.
- **Prompt:** _(from bob-runbook.md §1)_ "Onboard for
  `@.relay/tasks/T-001-refund-window/`. Read
  `.relay/knowledge/architecture.md` and `.relay/knowledge/gotchas.md`
  first. Then map the parts of `sample-project/` this task will touch -
  don't guess, read the actual files. Run `npx relay stage start onboard`
  before you begin and `npx relay stage end onboard` once you're oriented."
- **Dashboard:** JourneyRail's `onboard` node running, then done;
  ParallelLanes panel appears if subagents ran (mirrors T-000's own
  `knowledge-reader` + `codebase-mapper` split).
- **Voiceover:** "Onboarding reads the knowledge base _first_ - every past
  gotcha, before writing a line of code."
- **Fallback:** if the live onboard misbehaves (agent doesn't split into
  subagents, or reads the wrong files), cut to T-000's own JourneyRail
  onboard node in the mock and narrate over it - its duration (4m vs. a
  22m manual baseline) is real, measured data either way.

### 0:30–0:55 - Brief: REF-88

- **On screen:** `sample-project/docs/tickets/REF-88.pdf` open side-by-side
  with the terminal; cut to CriteriaCoverage panel filling in.
- **Bob mode:** `relay-brief`.
- **Prompt:** _(bob-runbook.md §2)_ "Extract acceptance criteria from
  `sample-project/docs/tickets/REF-88.pdf` - the full ticket including
  every comment. List each criterion as testable or not; for anything not
  testable, propose a measurable rewrite. Write `01-brief.md` and run
  `npx relay criteria list` to confirm what got recorded, then
  `npx relay stage end brief`."
- **Dashboard:** CriteriaCoverage panel populates with 4 (or 5, if the
  audit-log requirement became its own criterion - see
  `docs/demo-answer-key.md`) rows; the vague criterion should render in its
  distinct amber/untestable state with a proposed rewrite underneath.
- **Voiceover:** "The ticket has a vague criterion - 'refunds should be
  processed promptly' - and a second requirement that only exists in a
  comment. Watch whether the brief catches both."
- **Fallback:** T-000's own `01-brief.md` (open via JourneyRail) already
  narrates catching the vague criterion and rewriting it; the mock's
  `acceptanceCriteria` array is the CriteriaCoverage panel's data either
  way, so falling back here is seamless - just narrate from the mock
  instead of the live terminal.

### 0:55–1:15 - Plan → Implement **(sped up)**

- **On screen:** terminal, sped up through both stages; JourneyRail's
  `plan` then `implement` nodes completing.
- **Bob mode:** `relay-plan`, then `relay-implement`.
- **Prompts:** _(bob-runbook.md §3–4, both quoted, shown as terminal text
  overlay rather than read aloud - this beat is narrated over, not
  transcribed live)_.
- **Dashboard:** JourneyRail advancing; BatonPanel's "Files touched" list
  growing.
- **Voiceover:** "Planning records the road not taken, not just the one
  that was. Implementation follows it - and if it deviates, says so."
- **Fallback:** T-000's `02-plan.md` explicitly narrates two rejected
  alternatives (a precomputed-deadline design, and reusing `date-fns`'s
  day-level helpers - rejected for the exact class of bug this task hits).
  Good fallback material if a live take's plan is thin.

### 1:15–1:45 - Debug: the centerpiece

- **On screen:** failing test in the terminal, full screen; cut to
  KnowledgeFeed panel as the new entry appears with the pulsing "harvested
  this task" badge.
- **Bob mode:** `relay-debug`.
- **Prompt:** _(bob-runbook.md §5)_ "A test is failing. Investigate -
  don't guess. Find the actual root cause, fix it, and write
  `04-debug-notes.md` with the symptom, root cause, and fix. Then run
  `npx relay harvest <id> --task T-001` to record it in
  `.relay/knowledge/gotchas.md` for future tasks, and
  `npx relay stage end debug`."
- **Dashboard:** this is the shot to hold on - KnowledgeFeed's newest
  entry appearing live, accent-pulsing dot, "harvested this task" badge.
  Expand it on camera to show symptom/root cause/fix.
- **Voiceover:** "This is the flywheel, live: a bug just found gets written
  back immediately - not at the end of the sprint, not in someone's head."
- **Fallback:** this is the one beat where "just show the mock" is weakest
  (the live _discovery_ is the point) - but if it must fall back, open
  T-000's `04-debug-notes.md` via JourneyRail and narrate the investigation
  from the prose, then point at the KnowledgeFeed row for `gotcha-014` (present
  in T-000's mock data even though a freshly-reset live knowledge base
  wouldn't have it yet - see the split explained above).

### 1:45–2:05 - Test: honest amber coverage

- **On screen:** test output in terminal; cut to CriteriaCoverage panel's
  header stat.
- **Bob mode:** `relay-test`.
- **Prompt:** _(bob-runbook.md §6)_ "Write tests in
  `sample-project/tests/` for each criterion in `01-brief.md`. For each
  one, run `npx relay criteria cover <id> --test <ref>` if it's genuinely
  covered, or leave it uncovered - don't mark something covered because it
  merely compiles. Write `05-tests.md`, then `npx relay stage end test`."
- **Dashboard:** CriteriaCoverage's "N of M covered" stat, with the
  admin-override criterion likely still amber/uncovered - call this out
  explicitly as a feature, not a gap in the demo.
- **Voiceover:** "Three of four, honestly. The dashboard doesn't hide the
  one that isn't tested yet - that's the point."
- **Fallback:** T-000's own mock is exactly this shape (3 of 4 covered,
  AC-4 honestly uncovered) - the cleanest fallback in the whole script,
  since it's literally designed to demonstrate this.

### 2:05–2:25 - Review + PR

- **On screen:** terminal; cut to the PR description being written.
- **Bob mode:** `relay-review`, then `relay-pr`.
- **Prompts:** _(bob-runbook.md §7–8)_
- **Dashboard:** JourneyRail's `review` and `pr` nodes completing; open
  `06-review.md` via its slide-over to show the suggested review path.
- **Voiceover:** "Review reads everything - the plan, the criteria, the
  gotcha log - and leaves a reading order, not just a verdict."
- **Fallback:** T-000's `06-review.md` and `07-pr.md` both already include
  a numbered suggested review path (start with the debug notes, then
  `validators.ts`, then `refundService.ts`) - narrate directly from those.

### 2:25–2:50 - Flywheel proof: REF-91

- **On screen:** `sample-project/docs/tickets/REF-91.pdf`; terminal running
  brief on the new ticket; cut to that brief's output mentioning the
  harvested gotcha _before_ any code exists for this second task.
- **Bob mode:** `relay-brief` again, on REF-91.
- **Prompt:** same brief prompt as 0:30, pointed at
  `sample-project/docs/tickets/REF-91.pdf` instead.
- **Dashboard:** switch the task switcher to the REF-91 task; its
  BatonPanel's "Knowledge available at onboarding" list should include the
  entry harvested during the REF-88 debug beat.
- **Voiceover:** "A second, unrelated ticket touches the same kind of date
  math - and this time, the system already knows what to watch out for,
  before a single line is written."
- **Fallback:** this beat has no mock equivalent - it depends on the
  earlier debug beat actually having harvested something live. If the
  debug beat fell back to the mock, skip this beat's live component and
  instead read `docs/demo-answer-key.md`'s REF-91 section aloud over the
  PDF, framing it as "this is what the flywheel is designed to do."

### 2:50–3:00 - Impact numbers

- **On screen:** terminal running `npx relay report`; cut to ImpactPanel.
- **Bob mode:** none - this is the operator, not Bob.
- **Dashboard:** ImpactPanel's big "time saved" stat and per-stage bars.
- **Voiceover:** _(read the actual percentage from whatever run just
  happened - do not read a number from a previous take)_. "One run,
  honestly measured, against a real manual baseline - methodology and
  caveats are public, in `docs/metrics-methodology.md`."
- **Fallback:** T-000's own numbers (3h05m saved, 55%, 8 of 9 stages
  compared) are real measured data from the mock's own baseline events -
  legitimate to show as-is if the live run's own `relay report` isn't
  ready in time.

## `bob_sessions/` screenshots needed

Per `bob_sessions/README.md`'s requirement, capture a session-summary
screenshot from a real hackathon-account Bob run (not this rehearsal
environment) for each stage beat above that actually runs live in the
recorded take: **onboard, brief (REF-88), plan, implement, debug, test,
review, pr, brief (REF-91)**. The **pain** and **impact numbers** beats
don't involve Bob directly and need no screenshot.
