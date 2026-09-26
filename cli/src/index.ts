#!/usr/bin/env node
// CLI entrypoint: arg parsing and command dispatch.
import { Command } from "commander";
import {
  cmdInit,
  cmdStart,
  cmdTaskNew,
  cmdTaskUse,
  cmdTaskTagAdd,
  cmdTaskTagRemove,
  cmdTaskList,
} from "./scaffold.js";
import {
  cmdStageStart,
  cmdStageEnd,
  cmdStageSkip,
  cmdStageCancel,
  cmdStageManual,
  cmdRecover,
} from "./stage.js";
import {
  cmdCriteriaList,
  cmdCriteriaCover,
  cmdCriteriaUncover,
} from "./criteria.js";
import { cmdHarvest } from "./harvest.js";
import { cmdTaskEstimate } from "./estimate.js";
import { cmdPrCheckConflicts } from "./pr.js";
import { cmdCompile } from "./compile.js";
import { cmdReport } from "./report.js";
import { cmdStatus } from "./status.js";
import { cmdDoctor } from "./doctor.js";
import { cmdDashboard } from "./dashboard.js";

const program = new Command();
program
  .name("relay")
  .description("Relay CLI - scaffolds and manages the .bob/ baton.");

function run(fn: () => Promise<void>): void {
  fn().catch((err: unknown) => {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  });
}

program
  .command("init")
  .description("Scaffold .bob/ from the packaged templates.")
  .option(
    "--force",
    "overwrite an existing .bob/ (never overwrites real tasks/knowledge)",
  )
  .action((opts) => run(() => cmdInit(opts)));

program
  .command("start <title>")
  .description(
    "Quickstart: scaffolds .bob/ if missing, creates a task, activates it, compiles, and opens the dashboard - the only thing left is switching Bob to onboarding.",
  )
  .option("--source-type <type>", "ticket|issue|adhoc")
  .option("--source-ref <ref>", "reference within the source system")
  .option("--baseline", "mark this as a manual baseline run")
  .option("--tag <tag>", "repeatable: attach a tag", (val, prev: string[]) => [...prev, val], [] as string[])
  .option("--port <port>", "dashboard port (default 4317)")
  .option("--no-dashboard", "don't compile or launch the dashboard")
  .option("--no-open", "don't auto-open a browser tab for the dashboard")
  .option(
    "--force",
    "re-scaffold .bob/ even if it already exists (never overwrites real tasks/knowledge)",
  )
  .action((title, opts) =>
    run(() =>
      cmdStart(title, {
        sourceType: opts.sourceType,
        sourceRef: opts.sourceRef,
        baseline: Boolean(opts.baseline),
        tags: opts.tag,
        port: opts.port,
        dashboard: opts.dashboard,
        open: opts.open,
        force: Boolean(opts.force),
      }),
    ),
  );

const task = program.command("task").description("Manage tasks.");

task
  .command("new <title>")
  .description("Create a new task folder and task.json.")
  .option("--source-type <type>", "ticket|issue|adhoc")
  .option("--source-ref <ref>", "reference within the source system")
  .option("--baseline", "mark this as a manual baseline run")
  .option("--tag <tag>", "repeatable: attach a tag", (val, prev: string[]) => [...prev, val], [] as string[])
  .action((title, opts) =>
    run(() =>
      cmdTaskNew(title, {
        sourceType: opts.sourceType,
        sourceRef: opts.sourceRef,
        baseline: Boolean(opts.baseline),
        tags: opts.tag,
      }),
    ),
  );

task
  .command("use <id>")
  .description("Set the active task.")
  .action((id) => run(() => cmdTaskUse(id)));

task
  .command("list")
  .description("List tasks, newest first.")
  .option("--tag <tag>", "filter to tasks having this tag")
  .action((opts) => run(() => cmdTaskList(opts)));

task
  .command("estimate")
  .description(
    "(Re)compute or view the estimated manual-completion baseline for a task. With no --method, computes the fallback tiers (historical average, then a hardcoded default) - free to rerun for testing. --method ai-estimated records the brief stage's LLM-produced estimate.",
  )
  .option("--task <id>")
  .option("--method <method>", "ai-estimated (only accepted value; omit for the automatic fallback tiers)")
  .option("--total-sec <n>", "required with --method ai-estimated", parseFloat)
  .option("--per-stage <spec>", 'comma-separated "stage=sec" pairs, e.g. "brief=600,plan=1800"')
  .option("--based-on <taskId>", "id of a similar past task this estimate was weighted against")
  .action((opts) =>
    run(() =>
      cmdTaskEstimate({
        task: opts.task,
        method: opts.method,
        totalSec: opts.totalSec,
        perStage: opts.perStage,
        basedOn: opts.basedOn,
      }),
    ),
  );

const taskTag = task.command("tag").description("Manage tags on a task.");

taskTag
  .command("add <tags...>")
  .option("--task <id>")
  .action((tags, opts) => run(() => cmdTaskTagAdd(tags, opts)));

taskTag
  .command("remove <tags...>")
  .option("--task <id>")
  .action((tags, opts) => run(() => cmdTaskTagRemove(tags, opts)));

const stage = program
  .command("stage")
  .description("Log stage timing and update task.json.");

stage
  .command("start <stage>")
  .option("--task <id>", "operate on a specific task instead of the active one")
  .option("--mode <mode>", "relay|baseline (defaults to the task's own mode)")
  .action((s, opts) => run(() => cmdStageStart(s, opts)));

stage
  .command("end <stage>")
  .option("--task <id>")
  .option("--mode <mode>")
  .action((s, opts) => run(() => cmdStageEnd(s, opts)));

stage
  .command("skip <stage>")
  .option("--task <id>")
  .action((s, opts) => run(() => cmdStageSkip(s, opts)));

stage
  .command("cancel <stage>")
  .description("Cancel a running stage; restores from snapshot or marks it failed.")
  .option("--task <id>")
  .option("--mode <mode>")
  .action((s, opts) => run(() => cmdStageCancel(s, opts)));

stage
  .command("manual <stage>")
  .description(
    "Record a stage as done that was worked by hand without `stage start` - prompts for (or accepts flags for) how long it actually took.",
  )
  .option("--task <id>")
  .option("--mode <mode>")
  .option("--minutes <n>", "how many minutes the stage actually took", parseFloat)
  .option("--started-at <iso>", "explicit ISO start timestamp (overrides --minutes)")
  .option("--completed-at <iso>", "explicit ISO completion timestamp (default: now)")
  .action((s, opts) =>
    run(() =>
      cmdStageManual(s, {
        task: opts.task,
        mode: opts.mode,
        minutes: opts.minutes,
        startedAt: opts.startedAt,
        completedAt: opts.completedAt,
      }),
    ),
  );

program
  .command("recover")
  .description("Find (and optionally fix) stages stuck running past the timeout.")
  .option("--yes", "cancel/restore each stuck stage found")
  .action((opts) => run(() => cmdRecover(opts)));

const criteria = program
  .command("criteria")
  .description("Work with acceptance criteria.");

criteria
  .command("list")
  .option("--task <id>")
  .action((opts) => run(() => cmdCriteriaList(opts)));

criteria
  .command("cover <id>")
  .option("--task <id>")
  .option("--test <ref>", "the covering test reference")
  .action((id, opts) => run(() => cmdCriteriaCover(id, opts)));

criteria
  .command("uncover <id>")
  .option("--task <id>")
  .action((id, opts) => run(() => cmdCriteriaUncover(id, opts)));

const pr = program
  .command("pr")
  .description("PR-related utilities.");

pr
  .command("check-conflicts")
  .description(
    "Dry-run merge against a base branch; reports conflicted files and stores result on the task.",
  )
  .option("--base <branch>", "base branch to check against (default: main or config.yml baseBranch)")
  .option("--task <id>", "operate on a specific task instead of the active one")
  .action((opts) => run(() => cmdPrCheckConflicts(opts)));

program
  .command("harvest <gotchaId>")
  .description(
    "Record that a knowledge entry was harvested for the current task.",
  )
  .option("--task <id>")
  .option("--mode <mode>")
  .action((id, opts) => run(() => cmdHarvest(id, opts)));

program
  .command("compile")
  .description("Compile .bob/ into dashboard/public/relay-data.json.")
  .option("--watch", "recompile on changes in .bob/")
  .action((opts) => run(() => cmdCompile(opts)));

program
  .command("report")
  .description("Print the baseline-vs-relay comparison.")
  .option("--json", "emit JSON")
  .option("--markdown", "emit a Markdown table")
  .option("--strict", "exit non-zero if any comparison is incomplete")
  .action((opts) => run(() => cmdReport(opts)));

program
  .command("status")
  .description("Print the active task summary.")
  .option("--task <id>")
  .action((opts) => run(() => cmdStatus(opts)));

program
  .command("doctor")
  .description("Check .bob/ config against its own baton and the gotchas.md parser.")
  .action(() => run(() => cmdDoctor()));

program
  .command("dashboard")
  .description("Serve the visual dashboard against this project's compiled data.")
  .option("--port <port>", "port to listen on (default 4317)")
  .option("--no-open", "don't auto-open a browser tab")
  .action((opts) => run(() => cmdDashboard(opts)));

program.parseAsync(process.argv);
