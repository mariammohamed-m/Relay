// Small filesystem helpers shared by every command: atomic writes so a crash
// mid-write never corrupts task.json, plus tolerant JSON/dir helpers.
import { mkdir, readFile, rename, rm, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

/** Write `content` to `filePath` atomically (temp file + rename). */
export async function atomicWrite(filePath: string, content: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmp, content, 'utf8');
  try {
    await rename(tmp, filePath);
  } catch (err) {
    await rm(tmp, { force: true });
    throw err;
  }
}

export async function writeJSON(filePath: string, data: unknown): Promise<void> {
  await atomicWrite(filePath, JSON.stringify(data, null, 2) + '\n');
}

export async function readJSON<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T;
}

/** Create `filePath` with `content` only if it doesn't already exist. Returns true if created. */
export async function writeIfAbsent(filePath: string, content: string): Promise<boolean> {
  if (existsSync(filePath)) return false;
  await atomicWrite(filePath, content);
  return true;
}

export async function listDirs(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

/**
 * Reads a task.json and fills in fields absent from older files (`tags`,
 * `updatedAt`, and the per-stage revisit fields `visitCount`/`history`/`staleSince`)
 * so every in-memory `Task` satisfies the current shape. The one place this
 * backward-compat tolerance lives, per AGENTS.md's data contract - never
 * duplicate these defaults at each call site.
 */
export async function readTask(filePath: string): Promise<import('./types.js').Task> {
  const { STAGES } = await import('./types.js');
  const raw = await readJSON<Record<string, unknown>>(filePath);
  const task = {
    ...raw,
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : (raw.createdAt as string),
  } as import('./types.js').Task;

  // Back-fill visitCount / history / staleSince for stage records written before
  // these fields existed.  A stage that is already done/skipped/failed counts as
  // visitCount=1 (it ran once); pending stages get 0.
  for (const s of STAGES) {
    const rec = task.stages[s];
    if (rec == null) continue;
    if (rec.visitCount === undefined || rec.visitCount === null) {
      rec.visitCount = (rec.status === 'pending') ? 0 : 1;
    }
    if (!Array.isArray(rec.history)) {
      rec.history = [];
    }
    if (rec.staleSince === undefined) {
      rec.staleSince = null;
    }
  }

  return task;
}

/**
 * Writes a task.json, stamping `updatedAt` to now on every call. This is
 * the single write path for task.json - no other code should call
 * `writeJSON` on a task directly, so no write can skip the timestamp.
 */
export async function saveTask(filePath: string, task: import('./types.js').Task): Promise<void> {
  await writeJSON(filePath, { ...task, updatedAt: new Date().toISOString() });
}
