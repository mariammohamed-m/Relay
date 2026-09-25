# Architecture

Relay is three layers around one shared data contract
(`cli/src/types.ts`, re-exported by `dashboard/src/lib/types.ts`).

## Layers

**1. Bob IDE configuration (`.bob/`)**
Custom modes, rules, and skills that make Bob read `.relay/knowledge/` at the
start of a task and write a structured stage artifact at the end of one.
Bob is the only thing that writes prose into `.relay/tasks/*/`; it never
writes the JSON directly - `task.json` is kept in sync by the CLI as stages
complete.

**2. CLI (`cli/`)**

- `scaffold` - creates a new `.relay/tasks/T-NNN-<slug>/` directory with an
  initial `task.json` and empty stage files.
- `events` - append-only writer/reader for `.relay/metrics/events.jsonl`.
- `compile` - reads all of `.relay/`, computes `ImpactSummary`, and writes
  `dashboard/public/relay-data.json`.
- `report` - terminal summary of relay-vs-baseline impact.

**3. Dashboard (`dashboard/`)**
A static React app that reads the single compiled `relay-data.json` file.
No server, no live queries - regenerate the file, refresh the page.

## The baton flow

```mermaid
flowchart LR
    subgraph Task["One task, one directory: .relay/tasks/T-NNN-slug/"]
        A[01-brief.md] --> B[02-plan.md]
        B --> C[03-implementation.md]
        C --> D[04-debug-notes.md]
        D --> E[05-tests.md]
        E --> F[06-review.md]
        F --> G[07-pr.md]
    end

    K[(.relay/knowledge/\ngotchas · architecture\ndecisions · glossary)]

    K -- read at onboard --> A
    D -- harvest --> K

    G --> Ev[.relay/metrics/events.jsonl]
    A --> Ev
    B --> Ev
    C --> Ev
    E --> Ev
    F --> Ev

    Ev --> Compile[relay compile]
    Task --> Compile
    K --> Compile
    Compile --> Data[dashboard/public/relay-data.json]
    Data --> Dash[Dashboard]
```

The loop that matters is `D -- harvest --> K -- read at onboard --> A` for
the **next** task: every debug session makes the next task's onboarding
faster. That's the flywheel.
