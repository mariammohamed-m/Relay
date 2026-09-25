// `relay stage start|end|skip|cancel` and `relay recover`.
import path from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolveActiveTask } from "./active.js";
import { atomicWrite, saveTask, listDirs, readTask } from "./fsutil.js";
import { appendEvent } from "./events.js";
import { STAGE_ARTIFACT, stubArtifactContent, isStubContent } from "./stageArtifact.js";
import { takeSnapshot, readLatestSnapshot } from "./history.js";
import { loadConfig, recoveryTimeoutMinutes, tasksDir } from "./paths.js";
import {
  STAGES,
  type StageId,
  type StageVisit,
  type Task,
  type RunMode,
  type StageCancelEvent,
} from "./types.js";

function assertStage(stage: string): asserts stage is StageId {
  if (!(STAGES as readonly string[]).includes(stage)) {
    throw new Error(
      `Unknown stage "${stage}". Valid stages: ${STAGES.join(", ")}`,
    );
  }
}

/**
 * Produces a compact plain-text change summary by comparing two strings.
 * Returns a one-line count plus up to 3 representative changed lines.
 * Never does an LLM call — purely a string diff.
 */
function computeChangeSummary(oldText: string, newText: string): string {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);

  const added = newLines.filter((l) => !oldSet.has(l) && l.trim() !== "");
  const removed = oldLines.filter((l) => !newSet.has(l) && l.trim() !== "");

  const summary = `+${added.length} lines, -${removed.length} lines`;
  const samples: string[] = [];
  for (const l of removed.slice(0, 2)) samples.push(`- ${l.slice(0, 80)}`);
  for (const l of added.slice(0, 2)) samples.push(`+ ${l.slice(0, 80)}`);

  return samples.length ? `${summary}; ${samples.join(" | ")}` : summary;
}

/**
 * Reads the current artifact content for `stage` from disk, or returns null
 * if the file doesn't exist or is still the untouched stub.
 */
async function readCurrentArtifact(
  dir: string,
  stage: StageId,
): Promise<string | null> {
  const artifactName = STAGE_ARTIFACT[stage];
  if (!artifactName) return null;
  const filePath = path.join(dir, artifactName);
  if (!existsSync(filePath)) return null;
  const content = await readFile(filePath, "utf8");
  if (isStubContent(stage, content)) return null;
  return content;
}

export interface StageOpts {
  task?: string;
  mode?: RunMode;
}

/**
 * Cancels a stuck/cancelled stage and either restores it from its most
 * recent `.history/` snapshot, or - if no snapshot has a usable artifact -
 * marks it `failed` with a reason. Mutates `task` in place and persists it;
 * the caller is responsible for any further changes (e.g. `stage start`
 * proceeding to start a different stage afterward).
 */
async function cancelAndRestore(
  dir: string,
  task: Task,
  stage: StageId,
  reason: StageCancelEvent["reason"],
  mode: RunMode,
): Promise<{ restored: boolean; detail: string }> {
  const now = new Date().toISOString();
  const snapshot = await readLatestSnapshot(dir, stage);
  const artifactName = STAGE_ARTIFACT[stage];

  await appendEvent({
    ts: now,
    task: task.id,
    mode,
    event: "stage_cancel",
    stage,
    reason,
  });

  if (snapshot && snapshot.artifactContent !== null) {
    // Full restore: task.json and artifact both roll back to the snapshot,
    // correctly undoing anything the cancelled run wrote (half-extracted
    // criteria, a half-written artifact) in one step.
    Object.assign(task, snapshot.task);
    task.stages[stage] = { ...task.stages[stage], restoredAt: now };
    if (artifactName) {
      await atomicWrite(path.join(dir, artifactName), snapshot.artifactContent);
    }
    await saveTask(path.join(dir, "task.json"), task);
    await appendEvent({
      ts: now,
      task: task.id,
      mode,
      event: "stage_restore",
      stage,
      snapshot: snapshot.id,
    });
    return { restored: true, detail: `restored from snapshot ${snapshot.id}` };
  }

  // No usable artifact snapshot. Still roll back task.json from whatever
  // snapshot exists (rolling back any side-effect writes), then fail the stage.
  if (snapshot) {
    Object.assign(task, snapshot.task);
  }
  const failureReason =
    reason === "abandoned"
      ? "Left running and detected abandoned when a different stage was started."
      : reason === "timeout"
        ? "Stuck running past the recovery timeout; recovered by `relay recover`."
        : "Cancelled with no usable prior snapshot to restore.";
  task.stages[stage] = {
    ...task.stages[stage],
    status: "failed",
    failure: { reason: failureReason, at: now },
  };
  if (artifactName) {
    await atomicWrite(path.join(dir, artifactName), stubArtifactContent(stage));
  }
  await saveTask(path.join(dir, "task.json"), task);
  await appendEvent({
    ts: now,
    task: task.id,
    mode,
    event: "stage_failed",
    stage,
    reason: failureReason,
  });
  return { restored: false, detail: `no usable snapshot - marked failed` };
}

export async function cmdStageStart(
  stageArg: string,
  opts: StageOpts,
): Promise<void> {
  assertStage(stageArg);
  const { dir, task } = await resolveActiveTask(opts.task);
  const mode = opts.mode ?? task.mode;

  // Auto-detect: a *different* stage left "running" is treated as abandoned
  // and recovered before this one starts - Bob never tells Relay about a
  // user-initiated cancel, so this is the only signal available.
  const abandoned = STAGES.find(
    (s) => s !== stageArg && task.stages[s].status === "running",
  );
  if (abandoned) {
    console.warn(
      `warning: stage "${abandoned}" was still running - treating it as abandoned and recovering it.`,
    );
    const result = await cancelAndRestore(dir, task, abandoned, "abandoned", mode);
    console.warn(`  -> ${abandoned}: ${result.detail}`);
  }

  const record = task.stages[stageArg];
  if (record.status === "running") {
    console.warn(
      `warning: stage "${stageArg}" was already running - resetting its start time.`,
    );
  }

  // Snapshot before mutating, so a cancel of *this* run has something to
  // restore to. Runs even on a stage's first-ever start (snapshot then just
  // carries task.json, no artifact - it was still a stub).
  await takeSnapshot(dir, stageArg, task);

  const now = new Date().toISOString();

  // -----------------------------------------------------------------------
  // Revisit logic: if this stage has run before (visitCount > 0), snapshot
  // the current state into history before resetting, and mark any downstream
  // completed stages as stale.
  // -----------------------------------------------------------------------
  const currentVisitCount = record.visitCount ?? 0;
  if (currentVisitCount > 0) {
    // Capture the outgoing artifact content.
    const artifactSnapshot = await readCurrentArtifact(dir, stageArg);

    const visit: StageVisit = {
      visitNumber: currentVisitCount,
      startedAt: record.startedAt ?? now,
      completedAt: record.completedAt ?? null,
      durationSec: record.durationSec ?? null,
      artifactSnapshot,
      changeSummary: null, // filled in by the next stage end
    };
    if (!Array.isArray(record.history)) record.history = [];
    record.history.push(visit);

    const visitLabel = currentVisitCount + 1;
    console.log(`${task.id}: revisiting ${stageArg} (visit ${visitLabel})`);

    // Mark any later completed stages as stale.
    const stageIdx = STAGES.indexOf(stageArg);
    for (let i = stageIdx + 1; i < STAGES.length; i++) {
      const downstream = STAGES[i];
      const ds = task.stages[downstream];
      if (ds.status === "done" || ds.status === "skipped") {
        ds.staleSince = now;
      }
    }

    await appendEvent({
      ts: now,
      task: task.id,
      mode,
      event: "revisit_detected",
      fromStage: stageArg,
      toStage: stageArg,
    });
  }

  record.visitCount = currentVisitCount + 1;
  record.status = "running";
  record.startedAt = now;
  record.completedAt = null;
  record.durationSec = null;
  record.failure = null;
  // Clear stale marker on the stage being revisited itself.
  record.staleSince = null;
  task.currentStage = stageArg;

  await saveTask(path.join(dir, "task.json"), task);
  await appendEvent({
    ts: now,
    task: task.id,
    mode,
    event: "stage_start",
    stage: stageArg,
  });
  console.log(`${task.id}: ${stageArg} started at ${now}`);
}

export async function cmdStageEnd(
  stageArg: string,
  opts: StageOpts,
): Promise<void> {
  assertStage(stageArg);
  const { dir, task } = await resolveActiveTask(opts.task);
  const record = task.stages[stageArg];
  const mode = opts.mode ?? task.mode;
  const now = new Date().toISOString();

  let startedAt = record.startedAt;
  if (record.status !== "running" || !startedAt) {
    console.warn(
      `warning: stage "${stageArg}" was never started - recording a best-effort 0s duration.`,
    );
    startedAt = now;
  }

  const durationSec = Math.max(
    0,
    Math.round((Date.parse(now) - Date.parse(startedAt)) / 1000),
  );
  const artifact = STAGE_ARTIFACT[stageArg] ?? "";

  record.status = "done";
  record.startedAt = startedAt;
  record.completedAt = now;
  record.durationSec = durationSec;
  record.artifact = artifact || record.artifact;

  // -----------------------------------------------------------------------
  // Revisit amend: if this is a revisit (visitCount > 1), back-fill the
  // changeSummary on the most recent history entry by diffing it against
  // the new artifact content that was just written.
  // -----------------------------------------------------------------------
  const visitCount = record.visitCount ?? 1;
  if (visitCount > 1 && Array.isArray(record.history) && record.history.length > 0) {
    const lastVisit = record.history[record.history.length - 1];
    const newContent = await readCurrentArtifact(dir, stageArg);
    if (lastVisit.artifactSnapshot !== null && newContent !== null) {
      lastVisit.changeSummary = computeChangeSummary(
        lastVisit.artifactSnapshot,
        newContent,
      );
    } else if (newContent !== null) {
      lastVisit.changeSummary = `(no prior snapshot) +${newContent.split("\n").length} lines`;
    }

    const changeSummary = lastVisit.changeSummary ?? "(no artifact to diff)";
    await appendEvent({
      ts: now,
      task: task.id,
      mode,
      event: "stage_amended",
      stage: stageArg,
      visitNumber: visitCount,
      changeSummary,
    });
    console.log(`${task.id}: ${stageArg} amended (visit ${visitCount}) - ${changeSummary}`);
  }

  await saveTask(path.join(dir, "task.json"), task);
  await appendEvent({
    ts: now,
    task: task.id,
    mode,
    event: "stage_end",
    stage: stageArg,
    durationSec,
    artifact,
  });
  console.log(`${task.id}: ${stageArg} done in ${durationSec}s`);
}

export async function cmdStageSkip(
  stageArg: string,
  opts: StageOpts,
): Promise<void> {
  assertStage(stageArg);
  const { dir, task } = await resolveActiveTask(opts.task);
  const record = task.stages[stageArg];
  record.status = "skipped";
  record.startedAt = record.startedAt ?? null;
  record.completedAt = null;
  record.durationSec = null;

  await saveTask(path.join(dir, "task.json"), task);
  console.log(`${task.id}: ${stageArg} marked skipped.`);
}

export async function cmdStageCancel(
  stageArg: string,
  opts: StageOpts,
): Promise<void> {
  assertStage(stageArg);
  const { dir, task } = await resolveActiveTask(opts.task);
  const mode = opts.mode ?? task.mode;
  const record = task.stages[stageArg];

  if (record.status !== "running") {
    console.log(
      `${task.id}: ${stageArg} is not running (status: ${record.status}) - nothing to cancel.`,
    );
    return;
  }

  const result = await cancelAndRestore(dir, task, stageArg, "explicit", mode);
  console.log(`${task.id}: ${stageArg} cancelled - ${result.detail}.`);
}

export async function cmdRecover(opts: { yes?: boolean }): Promise<void> {
  const cfg = await loadConfig();
  const timeoutMinutes = recoveryTimeoutMinutes(cfg);

  const dirs = await listDirs(tasksDir());
  const stuck: { dir: string; task: Task; stage: StageId; minutesRunning: number }[] = [];

  for (const d of dirs) {
    const full = path.join(tasksDir(), d);
    let task: Task;
    try {
      task = await readTask(path.join(full, "task.json"));
    } catch {
      continue;
    }
    for (const stage of STAGES) {
      const record = task.stages[stage];
      if (record.status !== "running" || !record.startedAt) continue;
      const minutesRunning = (Date.now() - Date.parse(record.startedAt)) / 60000;
      if (minutesRunning > timeoutMinutes) {
        stuck.push({ dir: full, task, stage, minutesRunning });
      }
    }
  }

  if (stuck.length === 0) {
    console.log(`No stages stuck running past ${timeoutMinutes}m.`);
    return;
  }

  console.log(`Found ${stuck.length} stage(s) stuck running past ${timeoutMinutes}m:`);
  for (const s of stuck) {
    console.log(
      `  ${s.task.id}: ${s.stage} running for ${Math.round(s.minutesRunning)}m`,
    );
  }

  if (!opts.yes) {
    console.log("\nRun with --yes to cancel/restore each of these.");
    return;
  }

  for (const s of stuck) {
    const result = await cancelAndRestore(s.dir, s.task, s.stage, "timeout", s.task.mode);
    console.log(`  -> ${s.task.id}: ${s.stage}: ${result.detail}`);
  }
}
