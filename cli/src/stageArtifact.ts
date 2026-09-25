// Fixed stage -> artifact-filename mapping (AGENTS.md "Task pipeline stage
// artifact mapping"). Every stage produces a task-directory file.
import type { StageId } from './types.js';

export const STAGE_ARTIFACT: Record<StageId, string | null> = {
  onboard: '00-onboard.md',
  brief: '01-brief.md',
  plan: '02-plan.md',
  implement: '03-implementation.md',
  debug: '04-debug-notes.md',
  test: '05-tests.md',
  review: '06-review.md',
  pr: '07-pr.md',
  docs: '08-docs.md',
};

const BOB_MODE: Record<StageId, string> = {
  onboard: 'Onboard',
  brief: 'Brief',
  plan: 'Plan',
  implement: 'Implement',
  debug: 'Debug',
  test: 'Test',
  review: 'Review',
  pr: 'PR',
  docs: 'Docs',
};

export function stubArtifactContent(stage: StageId): string {
  return `<!-- Filled in by Bob's "${BOB_MODE[stage]}" mode. -->\n`;
}

/** Whether `content` is still the untouched stub (no real work written yet). */
export function isStubContent(stage: StageId, content: string): boolean {
  return content.trim() === stubArtifactContent(stage).trim();
}
