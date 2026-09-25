// `relay doctor` - sanity-checks the .bob/ config against the .relay/ baton
// and the gotchas.md parser, so a broken stage mapping or a bad heading
// format is caught before a live Bob session hits it.
import path from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { relayRoot, activeFile, loadConfig, recoveryTimeoutMinutes, tasksDir, dashboardDataPath } from "./paths.js";
import { STAGES, SCHEMA_VERSION, type StageId } from "./types.js";
import { STAGE_ARTIFACT } from "./stageArtifact.js";
import { readTask, readJSON } from "./fsutil.js";

interface CheckResult {
  name: string;
  pass: boolean;
  detail: string;
}

const bobRoot = (): string => path.join(process.cwd(), ".bob");

// Mode each stage runs under, per .bob/custom_modes.yaml + FORMAT-NOTES.md.
const STAGE_MODE: Record<StageId, string> = {
  onboard: "relay-onboard",
  brief: "relay-brief",
  plan: "plan", // built-in
  implement: "agent", // built-in
  debug: "relay-debug",
  test: "relay-test",
  review: "relay-review",
  pr: "relay-pr",
  docs: "relay-docs",
};
const BUILTIN_MODES = new Set(["plan", "agent", "ask"]);

async function findMarkdownFiles(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await findMarkdownFiles(full)));
    else if (entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

async function checkStageModes(): Promise<CheckResult> {
  const file = path.join(bobRoot(), "custom_modes.yaml");
  if (!existsSync(file)) {
    return {
      name: "every stage has a mode or rules file",
      pass: false,
      detail: ".bob/custom_modes.yaml missing",
    };
  }
  const parsed = parseYaml(await readFile(file, "utf8")) as {
    customModes?: { slug: string }[];
  };
  const slugs = new Set((parsed.customModes ?? []).map((m) => m.slug));

  const problems: string[] = [];
  for (const stage of STAGES) {
    const mode = STAGE_MODE[stage];
    const isBuiltin = BUILTIN_MODES.has(mode);
    if (!isBuiltin && !slugs.has(mode)) {
      problems.push(
        `${stage}: mode "${mode}" not defined in custom_modes.yaml`,
      );
      continue;
    }
    const rulesDir = path.join(bobRoot(), `rules-${mode}`);
    if (!existsSync(rulesDir)) {
      problems.push(`${stage}: no .bob/rules-${mode}/ directory`);
    }
  }
  return {
    name: "every stage has a mode or rules file",
    pass: problems.length === 0,
    detail: problems.join("; ") || "ok",
  };
}

async function checkReferencedPaths(): Promise<CheckResult> {
  // "cli/src/*.ts" and "docs/*" only exist inside the Relay monorepo itself;
  // a project that merely installed bob-relay and ran `relay init` has
  // neither, so those references aren't checkable (or meaningful) there.
  const inRelayMonorepo = existsSync(path.join(process.cwd(), "cli", "src"));
  const files = [
    ...(await findMarkdownFiles(path.join(bobRoot(), "rules"))),
    ...(await findMarkdownFiles(bobRoot())),
  ];
  const artifactNames = new Set(
    Object.values(STAGE_ARTIFACT).filter((a): a is string => Boolean(a)),
  );
  const seen = new Set<string>();
  const problems: string[] = [];

  for (const file of [...new Set(files)]) {
    const text = await readFile(file, "utf8");
    const matches = text.matchAll(/`([\w./-]+\.[a-zA-Z]+)`/g);
    for (const m of matches) {
      const ref = m[1];
      if (seen.has(ref)) continue;
      seen.add(ref);
      if (artifactNames.has(ref)) continue; // written by an earlier stage
      if (ref === "AGENTS.md") continue; // created on first relay-docs run
      if (ref.startsWith(".relay/knowledge/")) {
        if (!existsSync(path.join(process.cwd(), ref)))
          problems.push(
            `${ref} (referenced in ${path.relative(process.cwd(), file)})`,
          );
        continue;
      }
      if (
        inRelayMonorepo &&
        (ref.startsWith("cli/src/") || ref.startsWith("docs/") || ref === "CLAUDE.md")
      ) {
        if (!existsSync(path.join(process.cwd(), ref)))
          problems.push(
            `${ref} (referenced in ${path.relative(process.cwd(), file)})`,
          );
      }
      // Other backtick spans (env vars, flags, code snippets) aren't file paths - skip.
    }
  }
  return {
    name: "every referenced path exists or is stage-created",
    pass: problems.length === 0,
    detail: problems.join("; ") || "ok",
  };
}

async function checkActiveResolves(): Promise<CheckResult> {
  if (!existsSync(activeFile())) {
    return {
      name: ".relay/.active resolves",
      pass: false,
      detail: ".relay/.active does not exist",
    };
  }
  const id = (await readFile(activeFile(), "utf8")).trim();
  if (!id)
    return {
      name: ".relay/.active resolves",
      pass: false,
      detail: ".relay/.active is empty",
    };
  const tasksDirPath = path.join(relayRoot(), "tasks");
  const dirs = existsSync(tasksDirPath) ? await readdir(tasksDirPath) : [];
  const match = dirs.find((d) => d === id || d.startsWith(`${id}-`));
  return {
    name: ".relay/.active resolves",
    pass: Boolean(match),
    detail: match
      ? `-> ${match}`
      : `"${id}" does not match any .relay/tasks/ directory`,
  };
}

async function checkBobignore(): Promise<CheckResult> {
  const file = path.join(process.cwd(), ".bobignore");
  if (!existsSync(file))
    return {
      name: ".bobignore does not exclude .relay/",
      pass: true,
      detail: "no .bobignore file",
    };
  const lines = (await readFile(file, "utf8")).split("\n").map((l) => l.trim());
  const excluding = lines.find(
    (l) =>
      l && !l.startsWith("#") && !l.startsWith("!") && /^\.relay\/?$/.test(l),
  );
  return {
    name: ".bobignore does not exclude .relay/",
    pass: !excluding,
    detail: excluding ? `found rule: "${excluding}"` : "ok",
  };
}

async function checkGotchaFormat(): Promise<CheckResult> {
  const files = [
    path.join(bobRoot(), "skills", "relay-harvest", "SKILL.md"),
    path.join(bobRoot(), "rules-relay-debug", "debug.md"),
  ].filter(existsSync);
  if (files.length === 0) {
    return {
      name: "gotcha format matches compile.ts parser",
      pass: false,
      detail: "no relay-harvest skill or debug rules found",
    };
  }
  const problems: string[] = [];
  for (const file of files) {
    const text = await readFile(file, "utf8");
    if (!/^##\s+gotcha-[\w-]+\s+-/m.test(text)) continue; // this file may not contain an example
    const requiredFields = [
      "discoveredIn",
      "discoveredAt",
      "costMinutes",
      "symptom",
      "rootCause",
      "fix",
      "watchOut",
      "codeRefs",
      "stalenessCheck",
    ];
    for (const field of requiredFields) {
      if (!new RegExp(`-\\s+\\*\\*${field}:\\*\\*`).test(text)) {
        problems.push(
          `${path.relative(process.cwd(), file)} missing field "${field}"`,
        );
      }
    }
  }
  return {
    name: "gotcha format matches compile.ts parser",
    pass: problems.length === 0,
    detail: problems.join("; ") || "ok",
  };
}

async function checkStuckStages(): Promise<CheckResult> {
  let timeoutMinutes = 30;
  try {
    timeoutMinutes = recoveryTimeoutMinutes(await loadConfig());
  } catch {
    // config.yml missing/unreadable - fall through with the default.
  }
  const tasksRoot = tasksDir();
  const dirs = existsSync(tasksRoot) ? await readdir(tasksRoot, { withFileTypes: true }) : [];
  const stuck: string[] = [];
  for (const entry of dirs) {
    if (!entry.isDirectory()) continue;
    const file = path.join(tasksRoot, entry.name, "task.json");
    if (!existsSync(file)) continue;
    try {
      const task = await readTask(file);
      for (const stage of STAGES) {
        const record = task.stages[stage];
        if (record.status !== "running" || !record.startedAt) continue;
        const minutes = (Date.now() - Date.parse(record.startedAt)) / 60000;
        if (minutes > timeoutMinutes) {
          stuck.push(`${task.id}: ${stage} (${Math.round(minutes)}m)`);
        }
      }
    } catch {
      // Unreadable task.json is reported elsewhere; doctor's stuck-stage check just skips it.
    }
  }
  return {
    name: `no stage stuck running past ${timeoutMinutes}m`,
    pass: stuck.length === 0,
    detail: stuck.length ? `${stuck.join("; ")} - run \`relay recover\`` : "ok",
  };
}

async function checkCompiledDataFresh(): Promise<CheckResult> {
  const name = "dashboard/public/relay-data.json is present and up to date";
  let outPath: string;
  try {
    outPath = dashboardDataPath(await loadConfig());
  } catch {
    return { name, pass: false, detail: ".relay/config.yml missing/unreadable" };
  }
  if (!existsSync(outPath)) {
    return { name, pass: false, detail: `missing - run \`relay compile\`` };
  }
  try {
    const data = await readJSON<{ schemaVersion?: number }>(outPath);
    if (data.schemaVersion !== SCHEMA_VERSION) {
      return {
        name,
        pass: false,
        detail: `schemaVersion ${data.schemaVersion} != ${SCHEMA_VERSION} - run \`relay compile\``,
      };
    }
  } catch (err) {
    return { name, pass: false, detail: `unreadable: ${(err as Error).message}` };
  }
  return { name, pass: true, detail: "ok" };
}

export async function runDoctor(): Promise<CheckResult[]> {
  return Promise.all([
    checkStageModes(),
    checkReferencedPaths(),
    checkActiveResolves(),
    checkBobignore(),
    checkGotchaFormat(),
    checkStuckStages(),
    checkCompiledDataFresh(),
  ]);
}

export async function cmdDoctor(): Promise<void> {
  const results = await runDoctor();
  for (const r of results) {
    console.log(`[${r.pass ? "PASS" : "FAIL"}] ${r.name} - ${r.detail}`);
  }
  const failed = results.filter((r) => !r.pass);
  if (failed.length > 0) {
    console.log(`\n${failed.length} check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log("\nAll checks passed.");
  }
}
