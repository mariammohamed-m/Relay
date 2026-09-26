// `relay init` and `relay task new`/`task use`.
import { existsSync } from "node:fs";
import { cp, readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { relayRoot, tasksDir, knowledgeDir, taskDir } from "./paths.js";
import {
  ensureDir,
  listDirs,
  writeIfAbsent,
  readTask,
  saveTask,
} from "./fsutil.js";
import { setActiveTask, resolveActiveTask } from "./active.js";
import {
  STAGES,
  type StageId,
  type StageRecord,
  type Task,
  type RunMode,
} from "./types.js";
import { STAGE_ARTIFACT, stubArtifactContent } from "./stageArtifact.js";
import { normalizeTag, normalizeTags } from "./tags.js";
import { cmdCompile } from "./compile.js";
import { cmdDashboard } from "./dashboard.js";
import { loadConfig } from "./paths.js";
import { fallbackEstimate } from "./estimate.js";

// Ships alongside dist/ in the published package - see cli/package.json "files".
const TEMPLATES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "templates",
);

/** True if `dir` contains anything beyond an optional `.gitkeep`. */
async function taskDirHasRealContent(dir: string): Promise<boolean> {
  if (!existsSync(dir)) return false;
  const entries = await readdir(dir);
  return entries.some((e) => e !== ".gitkeep");
}

/** True if any knowledge file's content has diverged from the shipped stub (or extra files exist). */
async function knowledgeDirHasRealContent(
  dir: string,
  templateDir: string,
): Promise<boolean> {
  if (!existsSync(dir)) return false;
  const [entries, stubEntries] = await Promise.all([
    readdir(dir),
    readdir(templateDir),
  ]);
  if (entries.some((e) => !stubEntries.includes(e))) return true;
  for (const name of stubEntries) {
    const existing = path.join(dir, name);
    if (!existsSync(existing)) continue;
    const [actual, stub] = await Promise.all([
      readFile(existing, "utf8"),
      readFile(path.join(templateDir, name), "utf8"),
    ]);
    if (actual !== stub) return true;
  }
  return false;
}

export async function cmdInit(
  opts: { force?: boolean },
  quiet?: boolean,
): Promise<void> {
  const cwd = process.cwd();
  const bobDir = path.join(cwd, ".bob");
  const relayDir = relayRoot(); // .bob/relay - the only path this ever writes to
  const bobExisted = existsSync(bobDir);
  const relaySubpackageExisted = existsSync(relayDir);

  if (!opts.force && relaySubpackageExisted) {
    console.error(
      "Refusing to overwrite existing .bob/relay/ - rerun with --force.",
    );
    process.exitCode = 1;
    return;
  }

  // .bob/ pre-dating this run means it's the developer's own (possibly
  // hand-configured) IDE setup - Relay never touches anything in it outside
  // .bob/relay/, but their existing modes/rules could still behave
  // differently than Relay's stages expect (e.g. a mode name collision, or a
  // rule that changes how Bob picks a mode), so flag it instead of staying
  // silent.
  if (bobExisted && !relaySubpackageExisted) {
    console.warn(
      "Found an existing .bob/ folder - installing Relay's modes/rules/skills into " +
        ".bob/relay/ so your existing config is untouched. Check for naming or " +
        "behavior conflicts (e.g. a custom mode/rule with the same trigger) with your own setup.",
    );
  }

  await ensureDir(relayDir);

  // Bob-side templates (custom_modes.yaml, rules-*/, skills/, commands/) -
  // isolated under .bob/relay/ rather than the shared .bob/ root.
  const templateBob = path.join(TEMPLATES_DIR, ".bob");
  for (const entry of await readdir(templateBob)) {
    await cp(path.join(templateBob, entry), path.join(relayDir, entry), {
      recursive: true,
      force: true,
    });
  }

  // Relay's own data templates (config.yml, knowledge/, tasks/) - same folder.
  const templateRelay = path.join(TEMPLATES_DIR, ".relay");
  const tasksReal = await taskDirHasRealContent(tasksDir());
  const knowledgeReal = await knowledgeDirHasRealContent(
    knowledgeDir(),
    path.join(templateRelay, "knowledge"),
  );

  for (const entry of await readdir(templateRelay)) {
    if (entry === "tasks" && tasksReal) {
      console.warn("Skipped .bob/relay/tasks/ - it already contains real tasks.");
      continue;
    }
    if (entry === "knowledge" && knowledgeReal) {
      console.warn(
        "Skipped .bob/relay/knowledge/ - it already contains harvested knowledge.",
      );
      continue;
    }
    await cp(path.join(templateRelay, entry), path.join(relayDir, entry), {
      recursive: true,
      force: true,
    });
  }

  console.log(
    (relaySubpackageExisted ? "Re-scaffolded" : "Created") + " .bob/relay/.",
  );
  if (!quiet) {
    console.log(
      "\nNext steps:\n" +
        "  1. Open this repo in Bob IDE - it will pick up .bob/relay/ automatically.\n" +
        "  2. Run `npx relay task new \"<title>\"` to start your first task.\n" +
        "  3. Run `npx relay doctor` any time to sanity-check the setup.",
    );
  }
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function nextTaskId(): Promise<string> {
  const dirs = await listDirs(tasksDir());
  const nums = dirs
    .map((d) => d.match(/^T-(\d+)/)?.[1])
    .filter((n): n is string => Boolean(n))
    .map(Number);
  const next = (nums.length ? Math.max(...nums) : -1) + 1;
  return `T-${String(next).padStart(3, "0")}`;
}

export interface TaskNewOptions {
  sourceType?: "ticket" | "issue" | "adhoc";
  sourceRef?: string;
  baseline?: boolean;
  tags?: string[];
}

export async function cmdTaskNew(
  title: string,
  opts: TaskNewOptions,
): Promise<void> {
  if (!existsSync(relayRoot())) {
    throw new Error(".bob/relay/ not found - run `relay init` first.");
  }
  const id = await nextTaskId();
  const slug = slugify(title) || "task";
  const dir = taskDir(id, slug);
  const mode: RunMode = opts.baseline ? "baseline" : "relay";
  const now = new Date().toISOString();

  const stages = {} as Record<StageId, StageRecord>;
  for (const s of STAGES) {
    stages[s] = {
      status: "pending",
      artifact: null,
      startedAt: null,
      completedAt: null,
      durationSec: null,
    };
  }

  const task: Task = {
    id,
    slug,
    title,
    source: { type: opts.sourceType ?? "adhoc", ref: opts.sourceRef ?? "" },
    createdAt: now,
    updatedAt: now,
    tags: normalizeTags(opts.tags ?? []),
    mode,
    currentStage: "onboard",
    stages,
    acceptanceCriteria: [],
    knowledgeHarvested: [],
    filesTouched: [],
  };

  // Populate the cheapest available estimate right away, so every normal
  // task gets a baseline comparison without a separate `--baseline` run -
  // the brief stage's AI call overwrites this with the higher-fidelity
  // `ai-estimated` tier once it runs (`relay task estimate --method
  // ai-estimated ...`). A baseline-mode task IS the real manual timer, so it
  // gets no estimate of its own.
  if (mode !== "baseline") {
    const cfg = await loadConfig();
    task.estimatedBaseline = fallbackEstimate(cfg);
  }

  await ensureDir(dir);
  await saveTask(path.join(dir, "task.json"), task);

  for (const stage of STAGES) {
    const artifact = STAGE_ARTIFACT[stage];
    if (!artifact) continue;
    await writeIfAbsent(path.join(dir, artifact), stubArtifactContent(stage));
  }

  await setActiveTask(id);

  console.log(`Created ${path.relative(process.cwd(), dir)}`);
  console.log(`Mode: ${mode}`);
  if (task.tags.length) console.log(`Tags: ${task.tags.join(", ")}`);
  console.log(`Active task set to ${id}.`);
  console.log(`\nPaste into Bob: @.bob/relay/tasks/${id}-${slug}/`);
}

export interface StartOptions extends TaskNewOptions {
  dashboard?: boolean;
  port?: string;
  open?: boolean;
  force?: boolean;
}

/**
 * Quickstart: init if needed, create+activate a task, compile, and serve the
 * dashboard - everything short of opening Bob itself. After this returns,
 * the only thing left for the developer to do is switch Bob to onboarding.
 * `--force` re-scaffolds .bob/relay/ even if it already exists (e.g. after
 * a previous partial/failed run left it half-written).
 */
export async function cmdStart(
  title: string,
  opts: StartOptions,
): Promise<void> {
  if (opts.force || !existsSync(relayRoot())) {
    await cmdInit({ force: opts.force }, /* quiet */ true);
  }
  await cmdTaskNew(title, opts);
  await cmdCompile({});
  if (opts.dashboard !== false) {
    await cmdDashboard({ port: opts.port, open: opts.open });
  }
  console.log(
    "\nAll set - open this repo in Bob IDE and switch to the Relay Onboard mode to begin.",
  );
}

export async function cmdTaskUse(id: string): Promise<void> {
  const dirs = await listDirs(tasksDir());
  const match = dirs.find((d) => d === id || d.startsWith(`${id}-`));
  if (!match) throw new Error(`No task found matching "${id}".`);
  await setActiveTask(id);
  console.log(`Active task set to ${match}.`);
}

async function loadAllTasksWithDirs(): Promise<{ dir: string; task: Task }[]> {
  const dirs = await listDirs(tasksDir());
  const out: { dir: string; task: Task }[] = [];
  for (const d of dirs) {
    const full = path.join(tasksDir(), d);
    try {
      out.push({ dir: full, task: await readTask(path.join(full, "task.json")) });
    } catch {
      // Skipped - compile already warns about unreadable task.json elsewhere.
    }
  }
  return out;
}

export interface TaskTagOptions {
  task?: string;
}

export async function cmdTaskTagAdd(
  tagsArg: string[],
  opts: TaskTagOptions,
): Promise<void> {
  const { dir, task } = await resolveActiveTask(opts.task);
  task.tags = normalizeTags([...task.tags, ...tagsArg]);
  await saveTask(path.join(dir, "task.json"), task);
  console.log(`${task.id}: tags -> ${task.tags.join(", ") || "(none)"}`);
}

export async function cmdTaskTagRemove(
  tagsArg: string[],
  opts: TaskTagOptions,
): Promise<void> {
  const { dir, task } = await resolveActiveTask(opts.task);
  const remove = new Set(normalizeTags(tagsArg));
  task.tags = task.tags.filter((t) => !remove.has(t));
  await saveTask(path.join(dir, "task.json"), task);
  console.log(`${task.id}: tags -> ${task.tags.join(", ") || "(none)"}`);
}

export async function cmdTaskList(opts: { tag?: string }): Promise<void> {
  const all = await loadAllTasksWithDirs();
  const filterTag = opts.tag ? normalizeTag(opts.tag) : null;
  const filtered = filterTag
    ? all.filter(({ task }) => task.tags.includes(filterTag))
    : all;
  const sorted = filtered.sort(
    (a, b) => Date.parse(b.task.createdAt) - Date.parse(a.task.createdAt),
  );

  if (sorted.length === 0) {
    console.log(filterTag ? `No tasks tagged "${filterTag}".` : "No tasks yet.");
    return;
  }

  for (const { task } of sorted) {
    const tags = task.tags.length ? ` [${task.tags.join(", ")}]` : "";
    console.log(
      `${task.id}  ${task.title}${tags}\n` +
        `  created ${task.createdAt}  last edited ${task.updatedAt}`,
    );
  }
}
