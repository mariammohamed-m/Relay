// `relay compile` - reads .bob/relay/tasks/**, .bob/relay/knowledge/**, and
// .bob/relay/metrics/events.jsonl, and writes dashboard/public/relay-data.json
// matching the RelayData shape in ./types.ts.
import path from "node:path";
import { watch } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { listDirs, readTask, writeJSON } from "./fsutil.js";
import { loadConfig, saveConfig, dashboardDataPath, relayRoot, tasksDir, type RelayConfig } from "./paths.js";
import { readEvents } from "./events.js";
import { readGotchasFile, parseGotchas } from "./knowledge.js";
import {
  STAGES,
  SCHEMA_VERSION,
  type CompiledTask,
  type EstimationMethod,
  type ImpactSummary,
  type RelayData,
  type RelayEvent,
  type StageId,
  type SubagentLane,
  type Task,
} from "./types.js";

async function readAllTasks(): Promise<CompiledTask[]> {
  const dirs = await listDirs(tasksDir());
  const tasks: CompiledTask[] = [];
  for (const d of dirs) {
    const file = path.join(tasksDir(), d, "task.json");
    try {
      const task = await readTask(file);
      const lastEditedAt = await attachStageContent(task, d);
      tasks.push({ ...task, lastEditedAt });
    } catch (err) {
      console.warn(
        `warning: skipping unreadable ${path.relative(process.cwd(), file)}: ${(err as Error).message}`,
      );
    }
  }
  return tasks;
}

/**
 * The dashboard reads no raw `.bob/relay/` files at runtime - a done stage's
 * markdown artifact has to travel inside the compiled snapshot itself
 * (`StageRecord.content`/`artifactMtime`), so this reads every stage's
 * artifact file off disk, embeds its content and mtime, and returns the
 * task's `lastEditedAt`: the max of `task.json`'s own `updatedAt` and every
 * artifact's mtime, since Bob edits artifact files directly without going
 * through the CLI (so a real edit never touches `updatedAt`).
 */
async function attachStageContent(task: Task, dirName: string): Promise<string> {
  let latest = Date.parse(task.updatedAt);
  for (const stage of STAGES) {
    const record = task.stages[stage];
    if (!record.artifact) {
      record.content = null;
      record.artifactMtime = null;
      continue;
    }
    const file = path.join(tasksDir(), dirName, record.artifact);
    if (!existsSync(file)) {
      record.content = null;
      record.artifactMtime = null;
      continue;
    }
    record.content = await readFile(file, "utf8");
    const mtime = (await stat(file)).mtime;
    record.artifactMtime = mtime.toISOString();
    latest = Math.max(latest, mtime.getTime());
  }
  return new Date(latest).toISOString();
}

/**
 * Pairs `subagent_start`/`subagent_end` events into per-stage lanes and
 * attaches them to `StageRecord.subagents`, for the same reason
 * {@link attachStageContent} embeds artifact text: the dashboard has no
 * access to raw events, only the compiled snapshot.
 */
function attachSubagentLanes(tasks: Task[], events: RelayEvent[]): void {
  const byTask = new Map<string, Task>(tasks.map((t) => [t.id, t]));
  const lanes = new Map<
    string,
    Map<string, { startedAt: string | null; completedAt: string | null }>
  >();

  for (const e of events) {
    if (e.event !== "subagent_start" && e.event !== "subagent_end") continue;
    const key = `${e.task}\u0000${e.stage}`;
    if (!lanes.has(key)) lanes.set(key, new Map());
    const byName = lanes.get(key)!;
    const times = byName.get(e.subagentName) ?? {
      startedAt: null,
      completedAt: null,
    };
    if (e.event === "subagent_start") times.startedAt = e.ts;
    else times.completedAt = e.ts;
    byName.set(e.subagentName, times);
  }

  for (const [key, byName] of lanes) {
    const [taskId, stage] = key.split("\u0000") as [string, StageId];
    const task = byTask.get(taskId);
    if (!task) continue;
    const sorted: SubagentLane[] = [...byName.entries()]
      .filter(([, t]) => t.startedAt !== null)
      .map(([name, t]) => ({
        name,
        startedAt: t.startedAt as string,
        completedAt: t.completedAt,
        durationSec: t.completedAt
          ? Math.round(
              (new Date(t.completedAt).getTime() -
                new Date(t.startedAt as string).getTime()) /
                1000,
            )
          : null,
      }))
      .sort(
        (a, b) =>
          new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
      );
    if (sorted.length > 0) task.stages[stage].subagents = sorted;
  }
}

const DEFAULT_MIN_SAMPLE_SIZE = 3;
const DEFAULT_FALLBACK_SEC = 21600;

/** Wall-clock seconds actually spent on a task across every stage/visit (current + history). Null if the task has no timing data at all. */
function totalTaskDurationSec(task: Task): number | null {
  let total = 0;
  let any = false;
  for (const stage of STAGES) {
    const rec = task.stages[stage];
    if (!rec) continue;
    if (rec.durationSec != null) {
      total += rec.durationSec;
      any = true;
    }
    for (const v of rec.history ?? []) {
      if (v.durationSec != null) {
        total += v.durationSec;
        any = true;
      }
    }
  }
  return any ? total : null;
}

function isFullyCompleted(task: Task): boolean {
  return STAGES.every((s) => {
    const status = task.stages[s]?.status;
    return status === "done" || status === "skipped";
  });
}

/**
 * Recomputes `estimation.averageTicketDurationSec` from completed real
 * (relay-mode) tasks and writes it back to config.yml if it changed - the
 * fallback tier `relay task estimate` (and the auto-estimate at `task new`
 * time) reads from. Null until `minSampleSize` such tasks exist, per
 * REQUIREMENT tier 2 - never present a too-small sample as a trustworthy
 * average.
 */
async function updateAverageTicketDuration(
  cfg: RelayConfig,
  tasks: Task[],
): Promise<RelayConfig> {
  const minSampleSize = cfg.estimation?.minSampleSize ?? DEFAULT_MIN_SAMPLE_SIZE;
  const defaultFallbackSec = cfg.estimation?.defaultFallbackSec ?? DEFAULT_FALLBACK_SEC;
  const durations = tasks
    .filter((t) => t.mode === "relay" && isFullyCompleted(t))
    .map(totalTaskDurationSec)
    .filter((d): d is number => d !== null);

  const averageTicketDurationSec =
    durations.length >= minSampleSize
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null;

  if (
    cfg.estimation?.averageTicketDurationSec === averageTicketDurationSec &&
    cfg.estimation?.minSampleSize === minSampleSize &&
    cfg.estimation?.defaultFallbackSec === defaultFallbackSec
  ) {
    return cfg;
  }
  const updated: RelayConfig = {
    ...cfg,
    estimation: { averageTicketDurationSec, minSampleSize, defaultFallbackSec },
  };
  await saveConfig(updated);
  return updated;
}

function computeEstimateAggregate(tasks: CompiledTask[]): {
  estimatedTotalSec: number | null;
  estimatedMethod: EstimationMethod | "mixed" | null;
} {
  const withEstimate = tasks
    .map((t) => t.estimatedBaseline)
    .filter((e): e is NonNullable<typeof e> => e != null);
  if (withEstimate.length === 0) {
    return { estimatedTotalSec: null, estimatedMethod: null };
  }
  const mean =
    withEstimate.reduce((sum, e) => sum + e.totalSec, 0) / withEstimate.length;
  const methods = new Set(withEstimate.map((e) => e.method));
  return {
    estimatedTotalSec: Math.round(mean),
    estimatedMethod: methods.size === 1 ? [...methods][0] : "mixed",
  };
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function computeImpact(tasks: CompiledTask[], events: RelayEvent[]): ImpactSummary {
  const perStage = STAGES.map(
    (
      stage,
    ): {
      stage: StageId;
      relaySec: number | null;
      baselineSec: number | null;
    } => {
      const durations = (mode: "relay" | "baseline") =>
        events
          .filter(
            (e) =>
              (e.event === "stage_end" || e.event === "stage_manual") &&
              e.stage === stage &&
              e.mode === mode,
          )
          .map((e) => (e as { durationSec: number }).durationSec);
      return {
        stage,
        relaySec: median(durations("relay")),
        baselineSec: median(durations("baseline")),
      };
    },
  );

  const totalRelaySec = perStage.every((s) => s.relaySec === null)
    ? null
    : perStage.reduce((sum, s) => sum + (s.relaySec ?? 0), 0);
  const totalBaselineSec = perStage.every((s) => s.baselineSec === null)
    ? null
    : perStage.reduce((sum, s) => sum + (s.baselineSec ?? 0), 0);

  let criteriaCovered = 0;
  let criteriaTotal = 0;
  for (const t of tasks) {
    criteriaTotal += t.acceptanceCriteria.length;
    criteriaCovered += t.acceptanceCriteria.filter((c) => c.covered).length;
  }

  // Cancelled/failed runs never produce a `stage_end` event, so they're
  // already excluded from every duration above; `excludedRuns` just makes
  // that count visible instead of silent.
  const excludedRuns = events.filter((e) => e.event === "stage_cancel").length;
  const { estimatedTotalSec, estimatedMethod } = computeEstimateAggregate(tasks);

  return {
    perStage,
    totalRelaySec,
    totalBaselineSec,
    criteriaCovered,
    criteriaTotal,
    excludedRuns,
    estimatedTotalSec,
    estimatedMethod,
  };
}

export async function compileOnce(): Promise<{
  data: RelayData;
  outPath: string;
}> {
  let cfg = await loadConfig();
  const tasks = await readAllTasks();
  cfg = await updateAverageTicketDuration(cfg, tasks);
  const events = await readEvents();
  attachSubagentLanes(tasks, events);
  const gotchasText = await readGotchasFile();
  const knowledge = parseGotchas(gotchasText);
  const impact = computeImpact(tasks, events);

  const data: RelayData = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    tasks,
    knowledge,
    impact,
  };

  const outPath = dashboardDataPath(cfg);
  await writeJSON(outPath, data);
  return { data, outPath };
}

export async function cmdCompile(opts: { watch?: boolean }): Promise<void> {
  const { outPath } = await compileOnce();
  console.log(`Wrote ${path.relative(process.cwd(), outPath)}`);

  if (!opts.watch) return;

  console.log("Watching .bob/relay/ for changes... (Ctrl+C to stop)");
  let pending = false;
  const recompile = async () => {
    if (pending) return;
    pending = true;
    setTimeout(async () => {
      try {
        const { outPath } = await compileOnce();
        console.log(`Recompiled -> ${path.relative(process.cwd(), outPath)}`);
      } catch (err) {
        console.warn(`warning: recompile failed: ${(err as Error).message}`);
      } finally {
        pending = false;
      }
    }, 200); // debounce a burst of writes from one Bob save
  };

  // ponytail: fs.watch recursive is win32/darwin only; add chokidar if Linux demo support is needed.
  watch(relayRoot(), { recursive: true }, () => {
    void recompile();
  });

  // Keep the process alive.
  await new Promise(() => {});
}
