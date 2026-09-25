// `relay status` - quick mid-demo orientation on the active task.
import { resolveActiveTask } from "./active.js";

export async function cmdStatus(opts: { task?: string }): Promise<void> {
  const { task } = await resolveActiveTask(opts.task);

  console.log(`Task: ${task.id} - ${task.title}`);
  console.log(`Mode: ${task.mode}`);
  console.log(`Current stage: ${task.currentStage}\n`);

  console.log("Stages:");
  for (const [stage, record] of Object.entries(task.stages)) {
    const dur = record.durationSec !== null ? ` (${record.durationSec}s)` : "";
    console.log(`  ${stage.padEnd(10)} ${record.status}${dur}`);
  }

  console.log("\nAcceptance criteria:");
  if (task.acceptanceCriteria.length === 0) {
    console.log("  none recorded yet");
  } else {
    const covered = task.acceptanceCriteria.filter((c) => c.covered).length;
    console.log(`  ${covered}/${task.acceptanceCriteria.length} covered`);
    for (const c of task.acceptanceCriteria) {
      console.log(`  ${c.id}: ${c.covered ? "covered" : "uncovered"}`);
    }
  }

  console.log(
    `\nKnowledge harvested: ${task.knowledgeHarvested.join(", ") || "none"}`,
  );
}
