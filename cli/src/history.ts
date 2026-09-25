// Snapshot/restore machinery behind the "cancelled stage recovery" bug fix:
// before a stage starts, its task.json + artifact (if real) are snapshotted
// into `.history/<stage>/<snapshot-id>/`, so a cancelled/abandoned run can be
// rolled back instead of leaving `status: "running"` stuck forever.
import path from "node:path";
import { readFile, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { atomicWrite, ensureDir, readJSON, writeJSON } from "./fsutil.js";
import { STAGE_ARTIFACT, isStubContent } from "./stageArtifact.js";
import type { StageId, Task } from "./types.js";

const MAX_SNAPSHOTS_PER_STAGE = 5;

/**
 * ISO 8601 with colons swapped for hyphens: a real ISO timestamp isn't a
 * legal Windows directory name, and this project runs on Windows. The
 * substitution is uniform, so lexicographic sort still matches chronological
 * order.
 */
function snapshotId(): string {
  return new Date().toISOString().replace(/:/g, "-");
}

function historyDir(taskDir: string, stage: StageId): string {
  return path.join(taskDir, ".history", stage);
}

/** Snapshots newest-first, filtered to ones with a readable task.json. */
export async function listSnapshots(
  taskDir: string,
  stage: StageId,
): Promise<string[]> {
  const dir = historyDir(taskDir, stage);
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const ids = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  const valid: string[] = [];
  for (const id of ids) {
    if (existsSync(path.join(dir, id, "task.json"))) valid.push(id);
  }
  return valid.sort().reverse();
}

/**
 * Snapshots the task's current task.json, and the stage's current artifact
 * only if it has real content (not the untouched stub) - so a fresh stage's
 * first-ever snapshot carries no artifact, per spec. Called at the top of
 * `relay stage start <stage>`, before anything else mutates state.
 */
export async function takeSnapshot(
  taskDir: string,
  stage: StageId,
  task: Task,
): Promise<void> {
  const id = snapshotId();
  const dir = path.join(historyDir(taskDir, stage), id);
  await ensureDir(dir);
  await writeJSON(path.join(dir, "task.json"), task);

  const artifactName = STAGE_ARTIFACT[stage];
  if (artifactName) {
    const artifactPath = path.join(taskDir, artifactName);
    if (existsSync(artifactPath)) {
      const content = await readFile(artifactPath, "utf8");
      if (!isStubContent(stage, content)) {
        await atomicWrite(path.join(dir, artifactName), content);
      }
    }
  }

  await pruneSnapshots(taskDir, stage);
}

async function pruneSnapshots(taskDir: string, stage: StageId): Promise<void> {
  const ids = await listSnapshots(taskDir, stage);
  const stale = ids.slice(MAX_SNAPSHOTS_PER_STAGE);
  const dir = historyDir(taskDir, stage);
  for (const id of stale) {
    await rm(path.join(dir, id), { recursive: true, force: true });
  }
}

export interface SnapshotContents {
  id: string;
  task: Task;
  /** Present only when the snapshot captured real artifact content. */
  artifactContent: string | null;
}

/** Reads the newest usable snapshot for `stage`, or null if none exists. */
export async function readLatestSnapshot(
  taskDir: string,
  stage: StageId,
): Promise<SnapshotContents | null> {
  const [id] = await listSnapshots(taskDir, stage);
  if (!id) return null;
  const dir = path.join(historyDir(taskDir, stage), id);
  try {
    const task = await readJSON<Task>(path.join(dir, "task.json"));
    const artifactName = STAGE_ARTIFACT[stage];
    let artifactContent: string | null = null;
    if (artifactName && existsSync(path.join(dir, artifactName))) {
      artifactContent = await readFile(path.join(dir, artifactName), "utf8");
    }
    return { id, task, artifactContent };
  } catch {
    return null; // corrupt snapshot - treated as "no usable snapshot"
  }
}
