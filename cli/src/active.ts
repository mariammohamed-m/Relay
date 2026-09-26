// Resolves "the current task" per AGENTS.md §4: --task flag, then .active
// file, then most-recently-modified task folder, else a helpful error.
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { activeFile, tasksDir } from './paths.js';
import { atomicWrite, listDirs, readTask } from './fsutil.js';
import type { Task } from './types.js';

export class CliError extends Error {}

export interface ActiveTask {
  id: string;
  dir: string;
  task: Task;
}

async function findTaskDirById(id: string): Promise<string | null> {
  const dirs = await listDirs(tasksDir());
  const match = dirs.find((d) => d === id || d.startsWith(`${id}-`));
  return match ? path.join(tasksDir(), match) : null;
}

async function mostRecentTaskDir(): Promise<string | null> {
  const dirs = await listDirs(tasksDir());
  if (dirs.length === 0) return null;
  const withMtime = await Promise.all(
    dirs.map(async (d) => {
      const full = path.join(tasksDir(), d);
      const s = await stat(path.join(full, 'task.json')).catch(() => null);
      return { full, mtime: s?.mtimeMs ?? 0 };
    })
  );
  withMtime.sort((a, b) => b.mtime - a.mtime);
  return withMtime[0].full;
}

export async function resolveActiveTask(explicitId?: string): Promise<ActiveTask> {
  let dir: string | null = null;

  if (explicitId) {
    dir = await findTaskDirById(explicitId);
    if (!dir) throw new CliError(`No task found matching "${explicitId}".`);
  } else if (existsSync(activeFile())) {
    const id = (await readFile(activeFile(), 'utf8')).trim();
    if (id) dir = await findTaskDirById(id);
  }

  if (!dir) {
    dir = await mostRecentTaskDir();
  }

  if (!dir) {
    throw new CliError(
      'No active task. Run `relay task new "<title>"` to create one, or pass --task <id>.'
    );
  }

  const task = await readTask(path.join(dir, 'task.json'));
  return { id: task.id, dir, task };
}

export async function setActiveTask(folderName: string): Promise<void> {
  await atomicWrite(activeFile(), folderName + '\n');
}
