// Re-exports the CLI's stub-content check (same reasoning as lib/types.ts:
// one definition, never a fork) so the dashboard can tell a genuinely-empty
// or stub artifact apart from real content without duplicating the stub text.
import { isStubContent } from '../../../cli/src/stageArtifact';
import type { StageId } from './types';

export function isStubArtifact(stage: StageId, content: string | null): boolean {
  if (!content || content.trim().length === 0) return true;
  return isStubContent(stage, content);
}
