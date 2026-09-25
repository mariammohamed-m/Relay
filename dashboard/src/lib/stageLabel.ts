import type { StageId } from '@/lib/types';

const OVERRIDES: Partial<Record<StageId, string>> = { pr: 'PR' };

export function stageLabel(id: StageId): string {
  return OVERRIDES[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}
