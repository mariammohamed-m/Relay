import { STAGES, type StageStatus, type Task } from '@/lib/types';

const fill: Record<StageStatus, string> = {
  done: 'bg-ok',
  running: 'bg-accent',
  skipped: 'bg-line-strong',
  pending: 'bg-raised',
  failed: 'bg-bad',
};

export function StageStrip({ task }: { task: Task }) {
  return (
    <span className="flex gap-0.5" aria-hidden>
      {STAGES.map((id) => (
        <span key={id} className={`h-3 w-1.5 rounded-sm ${fill[task.stages[id].status]}`} />
      ))}
    </span>
  );
}
