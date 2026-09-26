# Metrics methodology

How the relay-vs-baseline numbers on the dashboard and in `relay report` are
produced, what they actually mean, and where they're weak. Read this before
trusting (or presenting) any number this repo generates.

## The planted bug, disclosed

**T-000-refund-window's `debug` stage is not organic.** `sample-project`
ships with a deterministic timezone bug in its shared date utility (see
`docs/demo-answer-key.md` for the full technical writeup) specifically so a
live demo run reliably has something real to debug, rather than hoping one
turns up. This is disclosed here, in the open, rather than left for someone
to discover and wonder whether it was cherry-picked after the fact. It's a
real bug, with a real root cause, that a real implementation of this feature
would realistically hit - it's just guaranteed to be _there_, rather than
hoped for.

Nothing else about the measured timings is staged: stage durations are
whatever `relay stage start`/`end` actually record, wall-clock, during
whatever run produced them.

## Baseline protocol

A baseline run measures how long the same work takes **without** Relay or
Bob, using only normal editor/terminal tools, so it can be compared against
a Relay-assisted run of the same ticket.

1. **Reset to the same starting state.** `node scripts/demo-reset.mjs --yes`
   before every run - relay and baseline alike - so both start from
   identical code, identical (absent) knowledge-base entries, and no
   leftover task folders. A baseline run measured against a different
   starting point than its relay counterpart isn't a comparison, it's two
   unrelated numbers.
2. **Create a baseline-mode task**, same ticket:
   ```
   npx relay task new "Enforce 30-day refund window on booking cancellations" \
     --source-type ticket --source-ref REF-88.pdf --baseline
   ```
   `--baseline` sets `Task.mode = "baseline"`, which is what tells `relay
report` (and the dashboard) this task is a comparison point, not a demo
   run to feature.
3. **Work the ticket by hand** - read `REF-88.pdf`, plan, implement, debug,
   test, review, open a PR - using whatever the developer would normally
   use (their editor, their own judgment, no AI pair). No Bob, no `.bob/`
   context reads, no shortcuts the relay-assisted run wouldn't also have
   available in spirit.
4. **Time every stage explicitly**, as it's entered and left:
   ```
   npx relay stage start <stage> --mode baseline
   ...do the actual work...
   npx relay stage end <stage> --mode baseline
   ```
   `stage start`/`stage end` operate on the active task by default (or
   `--task <id>` for a specific one) and both accept `--mode` so a
   baseline run's events are tagged `mode: "baseline"` in
   `.bob/metrics/events.jsonl`, distinct from a relay run's `mode:
"relay"` events on the same stage.

### What counts as a stage's start/end

The same boundaries a relay run uses, so the two are comparable:

| Stage       | Starts when...                                    | Ends when...                                      |
| ----------- | ------------------------------------------------- | ------------------------------------------------- |
| `onboard`   | you open the ticket/repo and start orienting      | you feel ready to write the brief                 |
| `brief`     | you start extracting requirements from the ticket | acceptance criteria are written down              |
| `plan`      | you start deciding on an approach                 | the approach is decided (before touching code)    |
| `implement` | you start writing the change                      | the change compiles/runs, ready for its own tests |
| `debug`     | something breaks and you start investigating      | the root cause is understood and fixed            |
| `test`      | you start writing/running tests                   | tests reflect the acceptance criteria             |
| `review`    | you start reviewing the diff                      | review comments are resolved                      |
| `pr`        | you start writing the PR description              | the PR is opened                                  |
| `docs`      | you start writing up anything learned             | it's written down (or skipped, honestly)          |

If a stage is skipped entirely (nothing to debug, say), record it with
`relay stage skip <stage>` rather than a zero-duration start/end pair - a
skip and a suspiciously fast stage are different facts and the tooling
keeps them distinct on purpose.

## Comparison rules

These are exactly what `cli/src/report.ts`'s `buildReport()` does - this
section is a plain-language description of that code, not a separate
policy:

- **Only stages present in _both_ a relay run and its paired baseline run
  are compared.** A stage with data on only one side is reported as "not
  comparable," never estimated from the other stages or from history.
- **Pairing** uses the relay task's `baselineTaskId` link when set;
  otherwise, if the same task id logged both `mode: relay` and `mode:
baseline` events (a single-task solo comparison, which is what T-000's
  own events.jsonl does), that's used as a fallback. `relay report`'s
  methodology output tells you plainly which pairing rule applied.
- **First completed occurrence only.** If a stage was started and ended
  more than once (a re-run), only the first `stage_end` event counts -
  later re-runs are excluded, so redoing a stage doesn't let you
  cherry-pick a faster second attempt into the numbers.
- **No extrapolation, ever.** A stage or a task with no baseline data
  contributes nothing to any total - it's reported as missing, not filled
  in with an average, a guess, or a number from a different task.
- **Totals are computed only over comparable stages** (both sides present)
  - a total is never a mix of real and estimated numbers.
- `relay report`'s per-stage numbers are **averages** of the (usually
  single) paired duration per stage. The dashboard's own aggregate
  `ImpactSummary` (`cli/src/compile.ts`) instead takes the **median**
  across however many relay/baseline `stage_end` events exist for that
  stage across all tasks - a deliberate difference: `report` compares one
  specific pair of runs, the dashboard summarizes however many runs exist.
  With a single paired run (as in this demo), the two agree exactly.

## Known biases - disclosed, not hidden

Honest limitations here are a credibility asset, not a weakness to paper
over:

- **The developer has seen the code before.** Whoever runs the manual
  baseline has, at minimum, read this repo's own T-000 mock artifacts and
  probably built or reviewed `sample-project` itself. A first-time
  developer encountering this codebase cold would likely take _longer_ on
  `onboard` and `implement` than the baseline reflects - meaning relay's
  measured advantage on those stages, if anything, understates Relay's
  real-world benefit for a genuinely unfamiliar codebase. Mitigation: none
  beyond disclosing it - there's no clean way to un-know a codebase for a
  fair baseline.
- **The bug was planted, and the baseline runner may know that.** If the
  same person runs both the baseline and the relay-assisted pass, they may
  recognize the timezone issue faster the second time (or even the first,
  having read this file). Mitigation: where possible, have someone who
  hasn't read `docs/demo-answer-key.md` run the baseline; where that's not
  possible (a one-person hackathon team), disclose it here instead of
  pretending the runs are more independent than they are.
- **n = 1.** One baseline run against one relay run is not a statistically
  meaningful sample - it's a demonstration, not an experiment. No
  variance, no confidence interval, no claim that the exact percentage
  saved generalizes. The dashboard and `relay report` both show the real
  numbers from the real runs that happened; neither claims those numbers
  are a population estimate.
- **Both runs target the same planted bug.** The debug-stage comparison
  specifically measures "find and fix this one known bug," not "debugging
  in general." A different bug, or a codebase without a deliberately
  reproducible one, would likely show a different (probably smaller, since
  this one was designed to be catchable) relay-vs-baseline gap on `debug`.

None of this is disqualifying for a demo - it's exactly the kind of thing a
real engineering audience will ask about, so it's answered here instead of
in the room.
