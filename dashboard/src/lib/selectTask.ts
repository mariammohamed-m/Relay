import type { Task } from '@/lib/types';

/** Most recent non-baseline task, falling back to the most recent task of any mode if every task is a baseline run. */
export function defaultActiveTaskId(tasks: Task[]): string | null {
  if (tasks.length === 0) return null;
  const byRecency = [...tasks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return (byRecency.find((t) => t.mode !== 'baseline') ?? byRecency[0]).id;
}
