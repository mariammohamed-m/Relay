# bob-relay

The CLI for Relay - carries structured context (the "baton") between the
stages of a dev workflow: onboard, brief, plan, implement, debug, test,
review, pr, docs. It scaffolds and manages `.bob/relay/` (Relay's own
subfolder inside your project's `.bob/` config); nothing else needs a server
or a database.

## Install

```bash
npm install -g bob-relay
```

## Quickstart

```bash
relay start "Fix the login redirect bug"
```

One command does everything: scaffolds `.bob/relay/` if this is a new
project (leaving any pre-existing `.bob/` config untouched), creates and
activates a task, compiles it, and opens the visual dashboard in your
browser. The only thing left is opening the repo in Bob IDE and switching to
the Relay Onboard mode.

Flags: `--port <n>` picks the dashboard port, `--no-open` skips the browser
tab, `--no-dashboard` skips compiling/serving entirely.

Prefer a one-off run without installing anything globally?

```bash
npx bob-relay init
npm install --save-dev bob-relay   # so later `relay` commands resolve locally
```

## Everyday commands

```bash
relay status              # what's the active task, what stage is it on
relay stage start <stage> # start a stage (onboard, brief, plan, implement, debug, test, review, pr, docs)
relay stage end <stage>   # finish it, records the artifact
relay compile              # write dashboard/public/relay-data.json
relay dashboard             # (re)open the visual dashboard for this project
relay doctor               # sanity-check the whole setup in one shot
```

Run `relay --help` (or `relay <command> --help`) for the full command
reference, including acceptance-criteria tracking, tags, and recovery from
an interrupted stage.

Requires Node 20+.

## License

MIT
