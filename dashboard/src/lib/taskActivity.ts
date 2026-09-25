import { STAGES, type Task } from '@/lib/types';
import { stageLabel } from '@/lib/stageLabel';

export function taskActivity(task: Task): string {
  const running = STAGES.find((id) => task.stages[id].status === 'running');
  if (running) return `${stageLabel(running)} running`;
  const failed = STAGES.find((id) => task.stages[id].status === 'failed');
  if (failed) return `${stageLabel(failed)} failed`;
  if (STAGES.every((id) => task.stages[id].status === 'done' || task.stages[id].status === 'skipped')) return 'Complete';
  return 'Waiting';
}
