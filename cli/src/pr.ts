// `relay pr check-conflicts`: dry-run merge against a base branch to detect
// conflicts without ever leaving the repo in a mid-merge state.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { resolveActiveTask } from './active.js';
import { saveTask } from './fsutil.js';
import { loadConfig } from './paths.js';
import type { ConflictCheck } from './types.js';

const execFileAsync = promisify(execFile);

/**
 * Run a git command in `cwd`, returning stdout. Throws on non-zero exit
 * unless `allowFailure` is true (used for commands where a non-zero exit
 * is part of the expected flow, e.g. a merge that produces conflicts).
 */
async function git(
  args: string[],
  cwd: string,
  allowFailure = false,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execFileAsync('git', args, { cwd });
    return { stdout, stderr, exitCode: 0 };
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number };
    if (allowFailure) {
      return {
        stdout: e.stdout ?? '',
        stderr: e.stderr ?? '',
        exitCode: typeof e.code === 'number' ? e.code : 1,
      };
    }
    throw new Error(
      `git ${args[0]} failed: ${e.stderr ?? e.message ?? String(e)}`,
    );
  }
}

/**
 * Resolve the default base branch from config.yml, falling back to "main".
 * `config.yml` does not currently define a `baseBranch` key, so this always
 * falls back to "main" until a project opts in by adding one.
 */
async function resolveBaseBranch(explicitBase?: string): Promise<string> {
  if (explicitBase) return explicitBase;
  try {
    const cfg = await loadConfig();
    const cfgAny = cfg as unknown as Record<string, unknown>;
    if (typeof cfgAny['baseBranch'] === 'string') return cfgAny['baseBranch'];
  } catch {
    // config.yml unreadable — fall back silently
  }
  return 'main';
}

/**
 * Perform a dry-run merge of HEAD into `baseBranch` and return the list of
 * conflicted file paths. The working tree is **never modified**: we use
 * `git merge-tree` (three-way merge on tree objects, no working-tree changes)
 * which is available in all Git versions ≥ 2.38 and falls back to a
 * `--no-commit --no-ff` merge (always aborted in a finally block) on older Git.
 *
 * Both strategies guarantee:
 *   - No commits are ever made.
 *   - The working tree is left clean regardless of outcome.
 *   - A crash mid-check still cleans up (finally / unconditional abort).
 */
async function detectConflicts(
  baseBranch: string,
  cwd: string,
): Promise<string[]> {
  // Strategy 1: `git merge-tree --write-tree` (Git ≥ 2.38).
  // Runs purely on tree objects; zero working-tree impact.
  const mergeTreeResult = await git(
    ['merge-tree', '--write-tree', baseBranch, 'HEAD'],
    cwd,
    true, // non-zero exit means conflicts exist
  );

  if (mergeTreeResult.exitCode !== 0) {
    // Parse conflicted paths from merge-tree output lines like:
    //   CONFLICT (content): Merge conflict in path/to/file.ts
    const files = parseMergeTreeConflicts(mergeTreeResult.stdout + mergeTreeResult.stderr);
    if (files.length > 0) return files;
    // If we got a non-zero exit but couldn't parse conflicts, fall through to
    // the merge strategy which gives cleaner output.
  }

  if (mergeTreeResult.exitCode === 0) {
    // Clean merge — no conflicts.
    return [];
  }

  // Strategy 2: fallback for older Git — `git merge --no-commit --no-ff`.
  // Always abort in a finally block so the repo is never left mid-merge.
  let conflictedFiles: string[] = [];
  try {
    const mergeResult = await git(
      ['merge', '--no-commit', '--no-ff', baseBranch],
      cwd,
      true, // non-zero exit expected when conflicts exist
    );

    if (mergeResult.exitCode !== 0 || mergeResult.stdout.includes('CONFLICT')) {
      // `git diff --name-only --diff-filter=U` lists unmerged (conflicted) paths.
      const diffResult = await git(
        ['diff', '--name-only', '--diff-filter=U'],
        cwd,
      );
      conflictedFiles = diffResult.stdout
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
    }
  } finally {
    // Unconditional abort — leaves the repo clean whether or not merge succeeded.
    await git(['merge', '--abort'], cwd, true);
  }

  return conflictedFiles;
}

/** Parse `CONFLICT (content): Merge conflict in <path>` lines from merge-tree output. */
function parseMergeTreeConflicts(output: string): string[] {
  const seen = new Set<string>();
  const results: string[] = [];
  for (const line of output.split('\n')) {
    const m = line.match(/CONFLICT[^:]*:\s*Merge conflict in (.+)/);
    if (m) {
      const f = m[1].trim();
      if (!seen.has(f)) { seen.add(f); results.push(f); }
    }
  }
  return results;
}

export interface PrCheckConflictsOptions {
  base?: string;
  task?: string;
}

export async function cmdPrCheckConflicts(
  opts: PrCheckConflictsOptions,
): Promise<void> {
  const baseBranch = await resolveBaseBranch(opts.base);
  const cwd = process.cwd();

  // Verify the base branch ref exists before attempting a merge.
  const refCheck = await git(
    ['rev-parse', '--verify', baseBranch],
    cwd,
    true,
  );
  if (refCheck.exitCode !== 0) {
    throw new Error(
      `Base branch "${baseBranch}" not found. Pass --base <branch> to override.`,
    );
  }

  console.log(`Checking for merge conflicts against "${baseBranch}"…`);
  const conflictedFiles = await detectConflicts(baseBranch, cwd);

  const check: ConflictCheck = {
    checkedAt: new Date().toISOString(),
    hasConflicts: conflictedFiles.length > 0,
    files: conflictedFiles,
    baseBranch,
  };

  // Persist result onto the task.
  const { dir, task } = await resolveActiveTask(opts.task);
  task.conflictCheck = check;
  await saveTask(path.join(dir, 'task.json'), task);

  if (check.hasConflicts) {
    console.log(`\n⚠  Merge conflicts detected (${check.files.length} file(s)):`);
    for (const f of check.files) {
      console.log(`   ${f}`);
    }
    console.log(
      '\nAddress the conflicts before opening the PR, or document them in 07-pr.md.',
    );
    process.exitCode = 1;
  } else {
    console.log('✓  No merge conflicts detected. Branch merges cleanly into ' + baseBranch + '.');
  }
}
