// `relay harvest <gotcha-id>` - records that a knowledge entry was pulled
// into the current task, and logs a knowledge_harvested event.
import path from "node:path";
import { resolveActiveTask } from "./active.js";
import { saveTask } from "./fsutil.js";
import { appendEvent } from "./events.js";
import { readGotchasFile, existsInGotchasText } from "./knowledge.js";

export async function cmdHarvest(
  id: string,
  opts: { task?: string; mode?: "relay" | "baseline" },
): Promise<void> {
  const { dir, task } = await resolveActiveTask(opts.task);

  const gotchasText = await readGotchasFile();
  if (!existsInGotchasText(gotchasText, id)) {
    console.warn(
      `warning: "${id}" was not found in .bob/knowledge/gotchas.md - recording anyway.`,
    );
  }

  if (!task.knowledgeHarvested.includes(id)) {
    task.knowledgeHarvested.push(id);
    await saveTask(path.join(dir, "task.json"), task);
  }

  const now = new Date().toISOString();
  await appendEvent({
    ts: now,
    task: task.id,
    mode: opts.mode ?? task.mode,
    event: "knowledge_harvested",
    id,
  });
  console.log(`${task.id}: harvested ${id}.`);
}
