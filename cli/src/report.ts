// `relay report` - the demo centerpiece: baseline-vs-relay comparison,
// printed honestly (no baseline data => say so, never extrapolate).
import { listDirs, readTask } from "./fsutil.js";
import { tasksDir } from "./paths.js";
import { readEvents } from "./events.js";
import {
  STAGES,
  type EstimationMethod,
  type RelayEvent,
  type StageEndEvent,
  type StageManualEvent,
  type StageId,
  type Task,
} from "./types.js";
import path from "node:path";

interface Pair {
  relayId: string;
  baselineId: string;
  /** true when the baseline events live under the relay task's own id (no explicit baselineTaskId link). */
  selfPaired: boolean;
}

interface StageComparison {
  stage: StageId;
  relaySec: number | null;
  baselineSec: number | null;
  /** Total seconds across ALL visits (history + current), for stages with revisits. */
  totalVisitSec: number | null;
  /** How many times this stage was visited (visitCount from task.json). */
  visitCount: number;
}

interface ReportData {
  methodology: string[];
  pairs: Pair[];
  perStage: StageComparison[];
  totalRelaySec: number | null;
  totalBaselineSec: number | null;
  criteriaCovered: number;
  criteriaTotal: number;
  criteriaByTask: { task: string; covered: number; total: number }[];
  knowledgeHarvested: string[];
  incompleteStages: StageId[];
  hasAnyBaseline: boolean;
  excludedRuns: number;
  /**
   * Per-task estimated baselines, labeled by tier so a fallback average is
   * never mistaken for a ticket-specific estimate. `hasRealBaseline` marks
   * tasks that also have an actual manual run (from `pairs`) - the real one
   * is primary there, this is shown only as a secondary note.
   */
  estimates: {
    task: string;
    totalSec: number;
    method: EstimationMethod;
    hasRealBaseline: boolean;
  }[];
}

/**
 * Computes the total time spent in a stage across all visits (history entries
 * + the current durationSec). For single-visit stages this equals durationSec.
 */
function totalStageSec(task: Task, stage: StageId): number | null {
  const rec = task.stages[stage];
  if (!rec) return null;
  const history = rec.history ?? [];
  const historyTotal = history.reduce(
    (sum, v) => sum + (v.durationSec ?? 0),
    0,
  );
  const current = rec.durationSec ?? 0;
  const total = historyTotal + current;
  // Return null only if there is genuinely no timing data at all.
  return rec.durationSec === null && history.every((v) => v.durationSec === null)
    ? null
    : total;
}

async function readAllTasks(): Promise<Task[]> {
  const dirs = await listDirs(tasksDir());
  const tasks: Task[] = [];
  for (const d of dirs) {
    try {
      tasks.push(await readTask(path.join(tasksDir(), d, "task.json")));
    } catch {
      // compile already warns about unreadable task.json; report just skips it.
    }
  }
  return tasks;
}

/**
 * First-completed stage_end (or stage_manual - equivalent for duration
 * purposes, see {@link StageManualEvent}) event per (task, mode, stage) -
 * later re-runs are excluded.
 */
function firstCompletedDurations(
  events: RelayEvent[],
): Map<string, StageEndEvent | StageManualEvent> {
  const map = new Map<string, StageEndEvent | StageManualEvent>();
  for (const e of events) {
    if (e.event !== "stage_end" && e.event !== "stage_manual") continue;
    const key = `${e.task}|${e.mode}|${e.stage}`;
    const existing = map.get(key);
    if (!existing || Date.parse(e.ts) < Date.parse(existing.ts))
      map.set(key, e);
  }
  return map;
}

function buildPairs(tasks: Task[], events: RelayEvent[]): Pair[] {
  const baselineModeTaskIds = new Set(
    events.filter((e) => e.mode === "baseline").map((e) => e.task),
  );
  const pairs: Pair[] = [];
  for (const t of tasks) {
    if (t.mode === "baseline") continue; // baseline tasks are targets, not sources, of a pair
    if (t.baselineTaskId) {
      pairs.push({
        relayId: t.id,
        baselineId: t.baselineTaskId,
        selfPaired: false,
      });
    } else if (baselineModeTaskIds.has(t.id)) {
      // Fallback: the same task logged both relay- and baseline-mode events
      // (e.g. a solo demo run timed both ways under one task id).
      pairs.push({ relayId: t.id, baselineId: t.id, selfPaired: true });
    }
  }
  return pairs;
}

export async function buildReport(): Promise<ReportData> {
  const tasks = await readAllTasks();
  const events = await readEvents();
  const firstDurations = firstCompletedDurations(events);
  const pairs = buildPairs(tasks, events);

  const methodology = [
    "Baseline vs Relay is computed only from stages present in BOTH a relay run and its paired baseline run.",
    'No stage is extrapolated: a missing baseline stage is reported as "no data", never estimated.',
    "When a stage was run more than once, only the first completed occurrence is used; re-runs are excluded.",
    pairs.some((p) => p.selfPaired)
      ? "Some tasks have no explicit baselineTaskId link - their own baseline-mode events (same task id) were paired as a fallback."
      : "Pairs use each task's explicit baselineTaskId link.",
  ];

  const perStage: StageComparison[] = STAGES.map((stage) => {
    const relayVals: number[] = [];
    const baselineVals: number[] = [];
    for (const p of pairs) {
      const r = firstDurations.get(`${p.relayId}|relay|${stage}`);
      const b = firstDurations.get(`${p.baselineId}|baseline|${stage}`);
      if (r) relayVals.push(r.durationSec);
      if (b) baselineVals.push(b.durationSec);
    }
    const avg = (vals: number[]) =>
      vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

    // Aggregate visit stats across all tasks for this stage.
    let totalVisitSec: number | null = null;
    let maxVisitCount = 0;
    for (const t of tasks) {
      const vSec = totalStageSec(t, stage);
      if (vSec !== null) totalVisitSec = (totalVisitSec ?? 0) + vSec;
      const vc = t.stages[stage]?.visitCount ?? 0;
      if (vc > maxVisitCount) maxVisitCount = vc;
    }

    return {
      stage,
      relaySec: avg(relayVals),
      baselineSec: avg(baselineVals),
      totalVisitSec,
      visitCount: maxVisitCount,
    };
  });

  const incompleteStages = perStage
    .filter(
      (s) =>
        (s.relaySec === null) !== (s.baselineSec === null) ||
        (s.relaySec === null && s.baselineSec === null),
    )
    .map((s) => s.stage)
    .filter((stage) => {
      // Only flag a stage "incomplete" if at least one side has data - a stage
      // nobody has touched yet isn't a comparison failure, just unstarted.
      const s = perStage.find((x) => x.stage === stage)!;
      return s.relaySec !== null || s.baselineSec !== null;
    });

  const comparable = perStage.filter(
    (s) => s.relaySec !== null && s.baselineSec !== null,
  );
  const totalRelaySec = comparable.length
    ? comparable.reduce((sum, s) => sum + (s.relaySec ?? 0), 0)
    : null;
  const totalBaselineSec = comparable.length
    ? comparable.reduce((sum, s) => sum + (s.baselineSec ?? 0), 0)
    : null;

  let criteriaCovered = 0;
  let criteriaTotal = 0;
  const criteriaByTask = tasks.map((t) => {
    const covered = t.acceptanceCriteria.filter((c) => c.covered).length;
    const total = t.acceptanceCriteria.length;
    criteriaCovered += covered;
    criteriaTotal += total;
    return { task: t.id, covered, total };
  });

  const knowledgeHarvested = [
    ...new Set(tasks.flatMap((t) => t.knowledgeHarvested)),
  ];

  const excludedRuns = events.filter((e) => e.event === "stage_cancel").length;

  const pairedTaskIds = new Set(pairs.map((p) => p.relayId));
  const estimates = tasks
    .filter((t): t is Task & { estimatedBaseline: NonNullable<Task["estimatedBaseline"]> } =>
      t.estimatedBaseline != null,
    )
    .map((t) => ({
      task: t.id,
      totalSec: t.estimatedBaseline.totalSec,
      method: t.estimatedBaseline.method,
      hasRealBaseline: pairedTaskIds.has(t.id),
    }));

  return {
    methodology,
    pairs,
    perStage,
    totalRelaySec,
    totalBaselineSec,
    criteriaCovered,
    criteriaTotal,
    criteriaByTask,
    knowledgeHarvested,
    incompleteStages,
    hasAnyBaseline: pairs.length > 0,
    excludedRuns,
    estimates,
  };
}

function fmtSec(s: number | null): string {
  if (s === null) return "no data";
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m${rem.toString().padStart(2, "0")}s`;
}

function estimateLabel(method: EstimationMethod): string {
  switch (method) {
    case "ai-estimated":
      return "Estimated (based on ticket analysis)";
    case "historical-average":
      return "Estimated (based on historical average)";
    case "default-fallback":
      return "Estimated (default)";
  }
}

function printHuman(r: ReportData): void {
  console.log("=== Relay: Baseline vs Relay Report ===\n");

  // Revisit summary: stages with more than 1 visit.
  const revisited = r.perStage.filter((s) => s.visitCount > 1);
  if (revisited.length > 0) {
    console.log("Stage revisit summary:");
    for (const s of revisited) {
      console.log(
        `  ${s.stage.padEnd(10)} visits: ${s.visitCount}  total time (all visits): ${fmtSec(s.totalVisitSec)}`,
      );
    }
    console.log();
  }

  if (!r.hasAnyBaseline) {
    console.log("No baseline run found for any task - nothing to compare yet.");
    console.log(
      "Run a manual timed pass with `relay task new --baseline` + `relay stage start/end` to enable this report.\n",
    );
  } else {
    console.log("Per stage:");
    for (const s of r.perStage) {
      if (s.relaySec === null && s.baselineSec === null) continue;
      const savingStr =
        s.relaySec !== null && s.baselineSec !== null
          ? `saved ${fmtSec(s.baselineSec - s.relaySec)} (${Math.round(((s.baselineSec - s.relaySec) / s.baselineSec) * 100)}%)`
          : "not comparable (missing one side)";
      const visitNote = s.visitCount > 1 ? ` [${s.visitCount} visits, total ${fmtSec(s.totalVisitSec)}]` : "";
      console.log(
        `  ${s.stage.padEnd(10)} baseline ${fmtSec(s.baselineSec).padEnd(9)} relay ${fmtSec(s.relaySec).padEnd(9)} ${savingStr}${visitNote}`,
      );
    }

    console.log("\nTotals (comparable stages only):");
    if (r.totalRelaySec !== null && r.totalBaselineSec !== null) {
      const pct = Math.round(
        ((r.totalBaselineSec - r.totalRelaySec) / r.totalBaselineSec) * 100,
      );
      console.log(
        `  baseline ${fmtSec(r.totalBaselineSec)}  relay ${fmtSec(r.totalRelaySec)}  saved ${fmtSec(r.totalBaselineSec - r.totalRelaySec)} (${pct}%)`,
      );
    } else {
      console.log("  Not enough comparable stages for a total.");
    }

    if (r.incompleteStages.length) {
      console.log(
        `\nIncomplete comparisons (data on only one side): ${r.incompleteStages.join(", ")}`,
      );
    }
  }

  console.log("\nAcceptance criteria coverage:");
  for (const t of r.criteriaByTask) {
    if (t.total === 0) continue;
    console.log(`  ${t.task}: ${t.covered}/${t.total} covered`);
  }
  console.log(`  Total: ${r.criteriaCovered}/${r.criteriaTotal} covered`);

  if (r.estimates.length) {
    console.log("\nEstimated baselines (per task):");
    for (const e of r.estimates) {
      const note = e.hasRealBaseline
        ? " - secondary note; actual manual run above is primary"
        : "";
      console.log(`  ${e.task}: ${fmtSec(e.totalSec)} - ${estimateLabel(e.method)}${note}`);
    }
  }

  console.log("\nKnowledge harvested:");
  console.log(
    r.knowledgeHarvested.length
      ? r.knowledgeHarvested.map((k) => `  ${k}`).join("\n")
      : "  none yet",
  );

  console.log("\nMethodology:");
  for (const m of r.methodology) console.log(`  - ${m}`);

  if (r.excludedRuns > 0) {
    console.log(
      `\n${r.excludedRuns} cancelled/failed run(s) excluded from the durations above.`,
    );
  }
}

function toMarkdown(r: ReportData): string {
  const lines = ["| Stage | Baseline | Relay | Saving |", "|---|---|---|---|"];
  for (const s of r.perStage) {
    if (s.relaySec === null && s.baselineSec === null) continue;
    const saving =
      s.relaySec !== null && s.baselineSec !== null
        ? `${fmtSec(s.baselineSec - s.relaySec)} (${Math.round(((s.baselineSec - s.relaySec) / s.baselineSec) * 100)}%)`
        : "-";
    lines.push(
      `| ${s.stage} | ${fmtSec(s.baselineSec)} | ${fmtSec(s.relaySec)} | ${saving} |`,
    );
  }
  if (r.totalRelaySec !== null && r.totalBaselineSec !== null) {
    const pct = Math.round(
      ((r.totalBaselineSec - r.totalRelaySec) / r.totalBaselineSec) * 100,
    );
    lines.push(
      `| **Total** | **${fmtSec(r.totalBaselineSec)}** | **${fmtSec(r.totalRelaySec)}** | **${fmtSec(r.totalBaselineSec - r.totalRelaySec)} (${pct}%)** |`,
    );
  }
  lines.push(
    "",
    `Acceptance criteria: ${r.criteriaCovered}/${r.criteriaTotal} covered.`,
  );
  if (r.estimates.length) {
    lines.push("", "Estimated baselines (per task):");
    for (const e of r.estimates) {
      const note = e.hasRealBaseline ? " (secondary - actual manual run is primary)" : "";
      lines.push(`- ${e.task}: ${fmtSec(e.totalSec)} - ${estimateLabel(e.method)}${note}`);
    }
  }
  lines.push("", "Methodology:");
  for (const m of r.methodology) lines.push(`- ${m}`);
  if (r.excludedRuns > 0) {
    lines.push(
      "",
      `${r.excludedRuns} cancelled/failed run(s) excluded from the durations above.`,
    );
  }
  return lines.join("\n");
}

export async function cmdReport(opts: {
  json?: boolean;
  markdown?: boolean;
  strict?: boolean;
}): Promise<void> {
  const r = await buildReport();

  if (opts.json) {
    console.log(JSON.stringify(r, null, 2));
  } else if (opts.markdown) {
    console.log(toMarkdown(r));
  } else {
    printHuman(r);
  }

  if (opts.strict && (!r.hasAnyBaseline || r.incompleteStages.length > 0)) {
    console.error("\n--strict: comparison incomplete.");
    process.exitCode = 1;
  }
}
