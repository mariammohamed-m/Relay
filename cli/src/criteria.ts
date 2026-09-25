// `relay criteria list|cover|uncover` - a fallback safety net for fixing
// AcceptanceCriterion coverage state without hand-editing task.json.
import path from "node:path";
import { resolveActiveTask } from "./active.js";
import { saveTask } from "./fsutil.js";

export async function cmdCriteriaList(opts: { task?: string }): Promise<void> {
  const { task } = await resolveActiveTask(opts.task);
  if (task.acceptanceCriteria.length === 0) {
    console.log(`${task.id}: no acceptance criteria recorded yet.`);
    return;
  }
  for (const c of task.acceptanceCriteria) {
    const mark = c.covered
      ? "✓ covered"
      : c.testable
        ? "✗ uncovered"
        : "- not testable";
    const ref = c.testRef ? ` (${c.testRef})` : "";
    console.log(`${c.id} [${mark}]${ref} - ${c.text}`);
  }
}

export async function cmdCriteriaCover(
  id: string,
  opts: { task?: string; test?: string },
): Promise<void> {
  const { dir, task } = await resolveActiveTask(opts.task);
  const c = task.acceptanceCriteria.find((c) => c.id === id);
  if (!c) throw new Error(`No acceptance criterion "${id}" on ${task.id}.`);
  if (!opts.test) throw new Error("`--test <ref>` is required.");
  c.covered = true;
  c.testRef = opts.test;
  await saveTask(path.join(dir, "task.json"), task);
  console.log(`${task.id}: ${id} marked covered (${opts.test}).`);
}

export async function cmdCriteriaUncover(
  id: string,
  opts: { task?: string },
): Promise<void> {
  const { dir, task } = await resolveActiveTask(opts.task);
  const c = task.acceptanceCriteria.find((c) => c.id === id);
  if (!c) throw new Error(`No acceptance criterion "${id}" on ${task.id}.`);
  c.covered = false;
  c.testRef = null;
  await saveTask(path.join(dir, "task.json"), task);
  console.log(`${task.id}: ${id} marked uncovered.`);
}
