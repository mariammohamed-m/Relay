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
  cmdRecover,
} from "./stage.js";
import {
  cmdCriteriaList,
  cmdCriteriaCover,
  cmdCriteriaUncover,
} from "./criteria.js";
import { cmdHarvest } from "./harvest.js";
import { cmdPrCheckConflicts } from "./pr.js";
import { cmdCompile } from "./compile.js";
import { cmdReport } from "./report.js";
import { cmdStatus } from "./status.js";
import { cmdDoctor } from "./doctor.js";
import { cmdDashboard } from "./dashboard.js";

const program = new Command();
program
  .name("relay")
  .description("Relay CLI - scaffolds and manages the .relay/ baton.");

function run(fn: () => Promise<void>): void {
  fn().catch((err: unknown) => {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  });
}

program
  .command("init")
  .description("Scaffold .bob/ and .relay/ from the packaged templates.")
  .option(
    "--force",
    "overwrite existing .bob/.relay (never touches real tasks/knowledge)",
  )
  .action((opts) => run(() => cmdInit(opts)));

program
  .command("start <title>")
  .description(
    "Quickstart: scaffolds .relay/ if missing, creates a task, activates it, compiles, and opens the dashboard - the only thing left is switching Bob to onboarding.",
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
    "re-scaffold .bob/.relay even if they already exist (never touches real tasks/knowledge)",
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
  .description("Compile .relay/ into dashboard/public/relay-data.json.")
  .option("--watch", "recompile on changes in .relay/")
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
  .description("Check .bob/ config against .relay/ and the gotchas.md parser.")
  .action(() => run(() => cmdDoctor()));

program
  .command("dashboard")
  .description("Serve the visual dashboard against this project's compiled data.")
  .option("--port <port>", "port to listen on (default 4317)")
  .option("--no-open", "don't auto-open a browser tab")
  .action((opts) => run(() => cmdDashboard(opts)));

program.parseAsync(process.argv);
