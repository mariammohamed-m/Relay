// Test suite for the Relay CLI. Uses node:test with a scratch cwd per test
// so nothing touches the real .bob/ fixture.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// paths.ts resolves everything off process.cwd(), so each test chdir's into
// its own scratch directory, runs the command modules, then restores cwd.
async function withScratchCwd<T>(fn: () => Promise<T>): Promise<T> {
  const dir = mkdtempSync(path.join(tmpdir(), "relay-test-"));
  const prevCwd = process.cwd();
  process.chdir(dir);
  try {
    return await fn();
  } finally {
    process.chdir(prevCwd);
    rmSync(dir, { recursive: true, force: true });
  }
}

test("task new produces a task.json satisfying the Task shape", async () => {
  await withScratchCwd(async () => {
    const { cmdInit, cmdTaskNew } = await import("./scaffold.js");
    const { STAGES } = await import("./types.js");
    await cmdInit({});
    await cmdTaskNew("Fix the thing", { sourceType: "adhoc" });

    const dir = path.join(
      process.cwd(),
      ".bob",
      "tasks",
      "T-000-fix-the-thing",
    );
    const task = JSON.parse(readFileSync(path.join(dir, "task.json"), "utf8"));

    assert.equal(task.id, "T-000");
    assert.equal(task.slug, "fix-the-thing");
    assert.equal(task.currentStage, "onboard");
    assert.equal(task.mode, "relay");
    for (const s of STAGES) {
      assert.equal(task.stages[s].status, "pending");
    }
    assert.deepEqual(task.acceptanceCriteria, []);
    assert.deepEqual(task.knowledgeHarvested, []);

    // Artifact stubs exist and are untouched by a second `task new`-unrelated read.
    assert.ok(readFileSync(path.join(dir, "01-brief.md"), "utf8").length > 0);
  });
});

test("start scaffolds, creates, activates, and compiles a task in one call", async () => {
  await withScratchCwd(async () => {
    const { cmdStart } = await import("./scaffold.js");
    // dashboard: false - a real HTTP server/browser launch has no place in a unit test.
    await cmdStart("Fix the thing", { sourceType: "adhoc", dashboard: false });

    const dir = path.join(
      process.cwd(),
      ".bob",
      "tasks",
      "T-000-fix-the-thing",
    );
    const task = JSON.parse(readFileSync(path.join(dir, "task.json"), "utf8"));
    assert.equal(task.id, "T-000");

    const active = readFileSync(
      path.join(process.cwd(), ".bob", ".active"),
      "utf8",
    ).trim();
    assert.equal(active, "T-000");

    const compiled = JSON.parse(
      readFileSync(
        path.join(process.cwd(), ".bob", "relay-data.json"),
        "utf8",
      ),
    );
    assert.ok(compiled.tasks.some((t: any) => t.id === "T-000"));
  });
});

test("stage start/end produce correct durations and update state", async () => {
  await withScratchCwd(async () => {
    const { cmdInit, cmdTaskNew } = await import("./scaffold.js");
    const { cmdStageStart, cmdStageEnd } = await import("./stage.js");
    await cmdInit({});
    await cmdTaskNew("Widget", { sourceType: "adhoc" });

    await cmdStageStart("plan", {});
    await new Promise((r) => setTimeout(r, 1100));
    await cmdStageEnd("plan", {});

    const dir = path.join(
      process.cwd(),
      ".bob",
      "tasks",
      "T-000-widget",
    );
    const task = JSON.parse(readFileSync(path.join(dir, "task.json"), "utf8"));
    assert.equal(task.stages.plan.status, "done");
    assert.ok(task.stages.plan.durationSec >= 1);
    assert.equal(task.stages.plan.artifact, "02-plan.md");

    const events = readFileSync(
      path.join(process.cwd(), ".bob", "metrics", "events.jsonl"),
      "utf8",
    )
      .trim()
      .split("\n")
      .map((l: string) => JSON.parse(l));
    assert.ok(
      events.some((e: any) => e.event === "stage_start" && e.stage === "plan"),
    );
    assert.ok(
      events.some((e: any) => e.event === "stage_end" && e.stage === "plan"),
    );

    const compiled = JSON.parse(
      readFileSync(path.join(process.cwd(), ".bob", "relay-data.json"), "utf8"),
    );
    assert.equal(
      compiled.tasks.find((t: any) => t.id === "T-000").stages.plan.status,
      "done",
    );
  });
});

test("out-of-order stage end warns but does not crash", async () => {
  await withScratchCwd(async () => {
    const { cmdInit, cmdTaskNew } = await import("./scaffold.js");
    const { cmdStageEnd } = await import("./stage.js");
    await cmdInit({});
    await cmdTaskNew("Widget", { sourceType: "adhoc" });

    await assert.doesNotReject(() => cmdStageEnd("debug", {}));

    const dir = path.join(
      process.cwd(),
      ".bob",
      "tasks",
      "T-000-widget",
    );
    const task = JSON.parse(readFileSync(path.join(dir, "task.json"), "utf8"));
    assert.equal(task.stages.debug.status, "done");
    assert.equal(task.stages.debug.durationSec, 0);
  });
});

test("compile on the Sprint 1 fixture produces valid RelayData", async () => {
  const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
  );
  const prevCwd = process.cwd();
  process.chdir(repoRoot);
  try {
    const { compileOnce } = await import("./compile.js");
    const { data } = await compileOnce();
    assert.equal(typeof data.schemaVersion, "number");
    assert.ok(Array.isArray(data.tasks));
    assert.ok(data.tasks.length >= 1);
    assert.ok(Array.isArray(data.knowledge));
    assert.ok(data.knowledge.some((k) => k.id === "gotcha-001"));
    assert.ok(Array.isArray(data.impact.perStage));
    assert.equal(data.impact.perStage.length, 9);
  } finally {
    process.chdir(prevCwd);
  }
});

test("a malformed events.jsonl line is skipped and compilation still succeeds", async () => {
  await withScratchCwd(async () => {
    const { cmdInit, cmdTaskNew } = await import("./scaffold.js");
    await cmdInit({});
    await cmdTaskNew("Widget", { sourceType: "adhoc" });

    appendFileSync(
      path.join(process.cwd(), ".bob", "metrics", "events.jsonl"),
      "not json at all\n",
    );

    const { compileOnce } = await import("./compile.js");
    await assert.doesNotReject(() => compileOnce());
  });
});

test("doctor passes all checks against the repo's real .bob/ config", async () => {
  const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
  );
  const prevCwd = process.cwd();
  process.chdir(repoRoot);
  try {
    const { runDoctor } = await import("./doctor.js");
    const results = await runDoctor();
    // T-000's `brief` stage is deliberately left "running" as a fixed-timestamp
    // demo fixture (to show an in-progress stage on the dashboard) - it will
    // always eventually clear the recovery timeout in real wall-clock time,
    // which is exactly what the stuck-stage check is supposed to catch. That's
    // a property of the fixture, not a config/format bug, so it's excluded
    // from this "everything else is well-formed" assertion.
    const failed = results.filter(
      (r) => !r.pass && !r.name.startsWith("no stage stuck running"),
    );
    assert.deepEqual(
      failed,
      [],
      `doctor checks failed: ${JSON.stringify(failed)}`,
    );
  } finally {
    process.chdir(prevCwd);
  }
});

test("doctor flags a stage with no mode and no rules directory", async () => {
  await withScratchCwd(async () => {
    const { cmdInit, cmdTaskNew } = await import("./scaffold.js");
    await cmdInit({});
    await cmdTaskNew("Widget", { sourceType: "adhoc" });
    // cmdInit scaffolds .bob/ from templates - remove one stage's rules dir
    // so doctor has something to flag.
    rmSync(path.join(process.cwd(), ".bob", "rules-relay-debug"), {
      recursive: true,
      force: true,
    });

    const { runDoctor } = await import("./doctor.js");
    const results = await runDoctor();
    const modeCheck = results.find(
      (r) => r.name === "every stage has a mode or rules file",
    );
    assert.equal(modeCheck?.pass, false);
  });
});

test("doctor flags .bobignore excluding .bob/", async () => {
  await withScratchCwd(async () => {
    const { cmdInit } = await import("./scaffold.js");
    await cmdInit({});
    const { writeFileSync } = await import("node:fs");
    writeFileSync(
      path.join(process.cwd(), ".bobignore"),
      "node_modules/\n.bob/\n",
    );

    const { runDoctor } = await import("./doctor.js");
    const results = await runDoctor();
    const ignoreCheck = results.find(
      (r) => r.name === ".bobignore does not exclude .bob/",
    );
    assert.equal(ignoreCheck?.pass, false);
  });
});

test("init refuses to overwrite an existing .bob/ without --force, and merges in with --force", async () => {
  await withScratchCwd(async () => {
    const { mkdirSync, writeFileSync, readFileSync, existsSync } = await import("node:fs");
    // Simulate a developer's own pre-existing .bob/ config, unrelated to Relay.
    mkdirSync(path.join(process.cwd(), ".bob", "rules-my-own-mode"), {
      recursive: true,
    });
    writeFileSync(
      path.join(process.cwd(), ".bob", "my-own-file.yaml"),
      "custom: true\n",
    );

    const { cmdInit } = await import("./scaffold.js");

    // Without --force, init refuses rather than overwrite.
    await cmdInit({});
    assert.ok(
      !existsSync(path.join(process.cwd(), ".bob", "custom_modes.yaml")),
    );
    process.exitCode = 0;

    // With --force, Relay's own files are installed alongside the developer's.
    await cmdInit({ force: true });
    assert.equal(
      readFileSync(
        path.join(process.cwd(), ".bob", "my-own-file.yaml"),
        "utf8",
      ),
      "custom: true\n",
    );
    assert.ok(
      readFileSync(
        path.join(process.cwd(), ".bob", "custom_modes.yaml"),
        "utf8",
      ).length > 0,
    );
  });
});

test("tags are normalized, deduped, and sorted; updatedAt is set on every write", async () => {
  await withScratchCwd(async () => {
    const { cmdInit, cmdTaskNew, cmdTaskTagAdd, cmdTaskTagRemove } =
      await import("./scaffold.js");
    await cmdInit({});
    await cmdTaskNew("Widget", {
      sourceType: "adhoc",
      tags: ["Billing", "billing", " Refunds! ", "a-b"],
    });

    const file = path.join(
      process.cwd(),
      ".bob",
      "tasks",
      "T-000-widget",
      "task.json",
    );
    let task = JSON.parse(readFileSync(file, "utf8"));
    assert.deepEqual(task.tags, ["a-b", "billing", "refunds"]);
    assert.equal(typeof task.updatedAt, "string");
    const createdUpdatedAt = task.updatedAt;

    await new Promise((r) => setTimeout(r, 20));
    await cmdTaskTagAdd(["Urgent"], {});
    task = JSON.parse(readFileSync(file, "utf8"));
    assert.deepEqual(task.tags, ["a-b", "billing", "refunds", "urgent"]);
    assert.notEqual(task.updatedAt, createdUpdatedAt);

    await cmdTaskTagRemove(["billing", "a-b"], {});
    task = JSON.parse(readFileSync(file, "utf8"));
    assert.deepEqual(task.tags, ["refunds", "urgent"]);
  });
});

test("task list sorts newest-first with and without a tag filter", async () => {
  await withScratchCwd(async () => {
    const { cmdInit, cmdTaskNew, cmdTaskList } = await import("./scaffold.js");
    await cmdInit({});
    await cmdTaskNew("First", { sourceType: "adhoc", tags: ["alpha"] });
    await cmdTaskNew("Second", { sourceType: "adhoc", tags: ["beta"] });
    await cmdTaskNew("Third", { sourceType: "adhoc", tags: ["alpha", "beta"] });

    const lines: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => lines.push(args.join(" "));
    try {
      await cmdTaskList({});
    } finally {
      console.log = origLog;
    }
    const ids = lines
      .filter((l) => l.startsWith("T-"))
      .map((l) => l.split(/\s+/)[0]);
    assert.deepEqual(ids, ["T-002", "T-001", "T-000"]);

    lines.length = 0;
    console.log = (...args: unknown[]) => lines.push(args.join(" "));
    try {
      await cmdTaskList({ tag: "beta" });
    } finally {
      console.log = origLog;
    }
    const filteredIds = lines
      .filter((l) => l.startsWith("T-"))
      .map((l) => l.split(/\s+/)[0]);
    assert.deepEqual(filteredIds, ["T-002", "T-001"]);
  });
});

test("compile/reads tolerate a task.json missing tags and updatedAt", async () => {
  await withScratchCwd(async () => {
    const { cmdInit, cmdTaskNew } = await import("./scaffold.js");
    await cmdInit({});
    await cmdTaskNew("Widget", { sourceType: "adhoc" });

    const file = path.join(
      process.cwd(),
      ".bob",
      "tasks",
      "T-000-widget",
      "task.json",
    );
    const task = JSON.parse(readFileSync(file, "utf8"));
    delete task.tags;
    delete task.updatedAt;
    const { writeFileSync } = await import("node:fs");
    writeFileSync(file, JSON.stringify(task, null, 2));

    const { compileOnce } = await import("./compile.js");
    const { data } = await compileOnce();
    const compiled = data.tasks.find((t) => t.id === "T-000")!;
    assert.deepEqual(compiled.tags, []);
    assert.equal(compiled.updatedAt, task.createdAt);
  });
});

test("stage start snapshots the artifact only when it has real content", async () => {
  await withScratchCwd(async () => {
    const { cmdInit, cmdTaskNew } = await import("./scaffold.js");
    const { cmdStageStart } = await import("./stage.js");
    const { listSnapshots, readLatestSnapshot } = await import("./history.js");
    await cmdInit({});
    await cmdTaskNew("Widget", { sourceType: "adhoc" });
    const dir = path.join(
      process.cwd(),
      ".bob",
      "tasks",
      "T-000-widget",
    );

    // First-ever start: artifact is still the stub, so no artifact should be snapshotted.
    await cmdStageStart("brief", {});
    let ids = await listSnapshots(dir, "brief");
    assert.equal(ids.length, 1);
    let snap = await readLatestSnapshot(dir, "brief");
    assert.equal(snap?.artifactContent, null);

    // Write real content, then start again (simulating a re-run) - now it should snapshot the real artifact.
    const { writeFileSync } = await import("node:fs");
    writeFileSync(path.join(dir, "01-brief.md"), "# Real brief content\n");
    await cmdStageStart("brief", {});
    ids = await listSnapshots(dir, "brief");
    assert.equal(ids.length, 2);
    snap = await readLatestSnapshot(dir, "brief");
    assert.equal(snap?.artifactContent, "# Real brief content\n");
  });
});

test("snapshot pruning keeps only the 5 most recent per stage", async () => {
  await withScratchCwd(async () => {
    const { cmdInit, cmdTaskNew } = await import("./scaffold.js");
    const { cmdStageStart, cmdStageEnd } = await import("./stage.js");
    const { listSnapshots } = await import("./history.js");
    await cmdInit({});
    await cmdTaskNew("Widget", { sourceType: "adhoc" });
    const dir = path.join(
      process.cwd(),
      ".bob",
      "tasks",
      "T-000-widget",
    );

    for (let i = 0; i < 7; i++) {
      await cmdStageStart("plan", {});
      await cmdStageEnd("plan", {});
    }
    const ids = await listSnapshots(dir, "plan");
    assert.equal(ids.length, 5);
  });
});

test("cancel with a snapshot restores the artifact and task.json exactly", async () => {
  await withScratchCwd(async () => {
    const { cmdInit, cmdTaskNew } = await import("./scaffold.js");
    const { cmdStageStart, cmdStageEnd, cmdStageCancel } =
      await import("./stage.js");
    await cmdInit({});
    await cmdTaskNew("Widget", { sourceType: "adhoc" });
    const dir = path.join(
      process.cwd(),
      ".bob",
      "tasks",
      "T-000-widget",
    );
    const artifactPath = path.join(dir, "01-brief.md");
    const { writeFileSync } = await import("node:fs");

    // A real, completed brief.
    writeFileSync(artifactPath, "# Good brief\n");
    await cmdStageStart("brief", {});
    writeFileSync(artifactPath, "# Good brief\n");
    await cmdStageEnd("brief", {});

    // Re-run it, then simulate a mid-run crash by overwriting with junk while still "running".
    await cmdStageStart("brief", {});
    writeFileSync(artifactPath, "JUNK HALF-WRITTEN CONTENT");

    await cmdStageCancel("brief", {});

    assert.equal(readFileSync(artifactPath, "utf8"), "# Good brief\n");
    const task = JSON.parse(readFileSync(path.join(dir, "task.json"), "utf8"));
    assert.equal(task.stages.brief.status, "done");
    assert.ok(task.stages.brief.restoredAt);
  });
});

test("cancel without a usable snapshot sets the stage to failed with a stub artifact", async () => {
  await withScratchCwd(async () => {
    const { cmdInit, cmdTaskNew } = await import("./scaffold.js");
    const { cmdStageStart, cmdStageCancel } = await import("./stage.js");
    await cmdInit({});
    await cmdTaskNew("Widget", { sourceType: "adhoc" });
    const dir = path.join(
      process.cwd(),
      ".bob",
      "tasks",
      "T-000-widget",
    );
    const artifactPath = path.join(dir, "01-brief.md");
    const { writeFileSync } = await import("node:fs");

    // First-ever run of `brief` - the pre-start snapshot has no artifact.
    await cmdStageStart("brief", {});
    writeFileSync(artifactPath, "JUNK HALF-WRITTEN CONTENT");
    await cmdStageCancel("brief", {});

    const task = JSON.parse(readFileSync(path.join(dir, "task.json"), "utf8"));
    assert.equal(task.stages.brief.status, "failed");
    assert.ok(task.stages.brief.failure?.reason);
    assert.ok(task.stages.brief.failure?.at);
    const { stubArtifactContent } = await import("./stageArtifact.js");
    assert.equal(
      readFileSync(artifactPath, "utf8"),
      stubArtifactContent("brief"),
    );
  });
});

test("starting a new stage auto-cancels a different stage left running", async () => {
  await withScratchCwd(async () => {
    const { cmdInit, cmdTaskNew } = await import("./scaffold.js");
    const { cmdStageStart } = await import("./stage.js");
    await cmdInit({});
    await cmdTaskNew("Widget", { sourceType: "adhoc" });
    const dir = path.join(
      process.cwd(),
      ".bob",
      "tasks",
      "T-000-widget",
    );

    await cmdStageStart("brief", {}); // left running, never ended
    await cmdStageStart("plan", {});

    const task = JSON.parse(readFileSync(path.join(dir, "task.json"), "utf8"));
    assert.equal(task.stages.brief.status, "failed"); // no prior snapshot to restore to
    assert.equal(task.stages.plan.status, "running");

    const events = readFileSync(
      path.join(process.cwd(), ".bob", "metrics", "events.jsonl"),
      "utf8",
    )
      .trim()
      .split("\n")
      .map((l: string) => JSON.parse(l));
    assert.ok(
      events.some(
        (e: any) =>
          e.event === "stage_cancel" &&
          e.stage === "brief" &&
          e.reason === "abandoned",
      ),
    );
  });
});

test("recover respects the configured timeout", async () => {
  await withScratchCwd(async () => {
    const { cmdInit, cmdTaskNew } = await import("./scaffold.js");
    const { cmdStageStart, cmdRecover } = await import("./stage.js");
    await cmdInit({});
    await cmdTaskNew("Widget", { sourceType: "adhoc" });
    const dir = path.join(
      process.cwd(),
      ".bob",
      "tasks",
      "T-000-widget",
    );
    await cmdStageStart("brief", {});

    // Backdate startedAt well past the 30m default timeout.
    const file = path.join(dir, "task.json");
    const task = JSON.parse(readFileSync(file, "utf8"));
    task.stages.brief.startedAt = new Date(
      Date.now() - 60 * 60000,
    ).toISOString();
    const { writeFileSync } = await import("node:fs");
    writeFileSync(file, JSON.stringify(task, null, 2));

    const lines: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => lines.push(args.join(" "));
    try {
      await cmdRecover({});
    } finally {
      console.log = origLog;
    }
    assert.ok(lines.some((l) => l.includes("brief")));
    let after = JSON.parse(readFileSync(file, "utf8"));
    assert.equal(after.stages.brief.status, "running"); // --yes not passed, nothing changed

    await cmdRecover({ yes: true });
    after = JSON.parse(readFileSync(file, "utf8"));
    assert.equal(after.stages.brief.status, "failed");
  });
});

test("a failed stage re-run via stage start clears the failure", async () => {
  await withScratchCwd(async () => {
    const { cmdInit, cmdTaskNew } = await import("./scaffold.js");
    const { cmdStageStart, cmdStageCancel } = await import("./stage.js");
    await cmdInit({});
    await cmdTaskNew("Widget", { sourceType: "adhoc" });
    const dir = path.join(
      process.cwd(),
      ".bob",
      "tasks",
      "T-000-widget",
    );
    const file = path.join(dir, "task.json");

    await cmdStageStart("brief", {});
    await cmdStageCancel("brief", {});
    let task = JSON.parse(readFileSync(file, "utf8"));
    assert.equal(task.stages.brief.status, "failed");

    await cmdStageStart("brief", {});
    task = JSON.parse(readFileSync(file, "utf8"));
    assert.equal(task.stages.brief.status, "running");
    assert.equal(task.stages.brief.failure, null);
  });
});

test("cancelled/failed runs are excluded from report durations and counted", async () => {
  await withScratchCwd(async () => {
    const { cmdInit, cmdTaskNew } = await import("./scaffold.js");
    const { cmdStageStart, cmdStageCancel, cmdStageEnd } =
      await import("./stage.js");
    const { buildReport } = await import("./report.js");
    await cmdInit({});
    await cmdTaskNew("Widget", { sourceType: "adhoc" });

    await cmdStageStart("plan", {});
    await cmdStageCancel("plan", {}); // no snapshot -> failed, no stage_end
    await cmdStageStart("plan", {});
    await cmdStageEnd("plan", {}); // this run completes normally

    const r = await buildReport();
    assert.equal(r.excludedRuns, 1);
  });
});

test("report refuses to compare when no baseline exists", async () => {
  await withScratchCwd(async () => {
    const { cmdInit, cmdTaskNew } = await import("./scaffold.js");
    const { buildReport } = await import("./report.js");
    await cmdInit({});
    await cmdTaskNew("Widget", { sourceType: "adhoc" });

    const r = await buildReport();
    assert.equal(r.hasAnyBaseline, false);
    assert.ok(r.perStage.every((s) => s.baselineSec === null));
  });
});

test("stage revisit increments visitCount, pushes history entry, and marks downstream stale", async () => {
  await withScratchCwd(async () => {
    const { cmdInit, cmdTaskNew } = await import("./scaffold.js");
    const { cmdStageStart, cmdStageEnd } = await import("./stage.js");
    await cmdInit({});
    await cmdTaskNew("Revisit test", { sourceType: "adhoc" });
    const dir = path.join(
      process.cwd(),
      ".bob",
      "tasks",
      "T-000-revisit-test",
    );
    const file = path.join(dir, "task.json");
    const { writeFileSync } = await import("node:fs");

    // Complete implement (stage 4) first pass.
    await cmdStageStart("implement", {});
    writeFileSync(
      path.join(dir, "03-implementation.md"),
      "# First implementation\nOriginal content\n",
    );
    await cmdStageEnd("implement", {});

    // Complete test (stage 6) - a downstream stage.
    await cmdStageStart("test", {});
    writeFileSync(path.join(dir, "05-tests.md"), "# First tests\n");
    await cmdStageEnd("test", {});

    let task = JSON.parse(readFileSync(file, "utf8"));
    assert.equal(task.stages.implement.visitCount, 1);
    assert.equal(task.stages.test.visitCount, 1);
    assert.equal(task.stages.test.staleSince, null);

    // NOW revisit implement - test should become stale.
    await cmdStageStart("implement", {});
    task = JSON.parse(readFileSync(file, "utf8"));
    assert.equal(
      task.stages.implement.visitCount,
      2,
      "visitCount should be 2 after revisit",
    );
    assert.equal(task.stages.implement.status, "running");
    assert.equal(
      task.stages.implement.history.length,
      1,
      "history should have 1 prior entry",
    );
    assert.equal(task.stages.implement.history[0].visitNumber, 1);
    assert.equal(
      task.stages.implement.history[0].artifactSnapshot,
      "# First implementation\nOriginal content\n",
    );
    assert.ok(task.stages.test.staleSince, "test stage should be marked stale");
    assert.equal(
      task.stages.implement.staleSince,
      null,
      "revisited stage itself should not be stale",
    );

    // Write updated artifact and end the revisit.
    writeFileSync(
      path.join(dir, "03-implementation.md"),
      "# Revised implementation\nNew content here\n",
    );
    await cmdStageEnd("implement", {});

    task = JSON.parse(readFileSync(file, "utf8"));
    assert.equal(task.stages.implement.status, "done");
    // changeSummary should be set on the history entry.
    const histEntry = task.stages.implement.history[0];
    assert.ok(histEntry.changeSummary, "changeSummary should be set");
    assert.ok(
      histEntry.changeSummary.includes("+"),
      "changeSummary should mention added lines",
    );
    assert.ok(
      histEntry.changeSummary.includes("-"),
      "changeSummary should mention removed lines",
    );

    // Events: revisit_detected and stage_amended should be present.
    const events = readFileSync(
      path.join(process.cwd(), ".bob", "metrics", "events.jsonl"),
      "utf8",
    )
      .trim()
      .split("\n")
      .map((l: string) => JSON.parse(l));
    assert.ok(
      events.some(
        (e: any) =>
          e.event === "revisit_detected" && e.fromStage === "implement",
      ),
    );
    assert.ok(
      events.some(
        (e: any) =>
          e.event === "stage_amended" &&
          e.stage === "implement" &&
          e.visitNumber === 2,
      ),
    );
  });
});

test("re-running test after implement revisit clears staleSince and adds its own history entry", async () => {
  await withScratchCwd(async () => {
    const { cmdInit, cmdTaskNew } = await import("./scaffold.js");
    const { cmdStageStart, cmdStageEnd } = await import("./stage.js");
    await cmdInit({});
    await cmdTaskNew("Revisit clear test", { sourceType: "adhoc" });
    const dir = path.join(
      process.cwd(),
      ".bob",
      "tasks",
      "T-000-revisit-clear-test",
    );
    const file = path.join(dir, "task.json");
    const { writeFileSync } = await import("node:fs");

    // implement first pass.
    await cmdStageStart("implement", {});
    writeFileSync(path.join(dir, "03-implementation.md"), "# First impl\n");
    await cmdStageEnd("implement", {});

    // test first pass.
    await cmdStageStart("test", {});
    writeFileSync(path.join(dir, "05-tests.md"), "# First tests\n");
    await cmdStageEnd("test", {});

    // Revisit implement → test becomes stale.
    await cmdStageStart("implement", {});
    writeFileSync(path.join(dir, "03-implementation.md"), "# Revised impl\n");
    await cmdStageEnd("implement", {});

    let task = JSON.parse(readFileSync(file, "utf8"));
    assert.ok(
      task.stages.test.staleSince,
      "test should be stale before re-run",
    );

    // Revisit test - should clear staleSince and add a history entry.
    await cmdStageStart("test", {});
    task = JSON.parse(readFileSync(file, "utf8"));
    assert.equal(
      task.stages.test.staleSince,
      null,
      "staleSince should be cleared on revisit",
    );
    assert.equal(task.stages.test.visitCount, 2);
    assert.equal(task.stages.test.history.length, 1);
    assert.equal(
      task.stages.test.history[0].artifactSnapshot,
      "# First tests\n",
    );

    writeFileSync(path.join(dir, "05-tests.md"), "# Updated tests\n");
    await cmdStageEnd("test", {});
    task = JSON.parse(readFileSync(file, "utf8"));
    assert.equal(task.stages.test.status, "done");
    assert.equal(task.stages.test.visitCount, 2);
  });
});

test("readTask backfills visitCount and history on old task.json without those fields", async () => {
  await withScratchCwd(async () => {
    const { cmdInit, cmdTaskNew } = await import("./scaffold.js");
    await cmdInit({});
    await cmdTaskNew("Compat test", { sourceType: "adhoc" });
    const file = path.join(
      process.cwd(),
      ".bob",
      "tasks",
      "T-000-compat-test",
      "task.json",
    );
    const { writeFileSync } = await import("node:fs");

    // Simulate an old task.json: manually set a stage to done without new fields.
    const task = JSON.parse(readFileSync(file, "utf8"));
    task.stages.brief.status = "done";
    task.stages.brief.durationSec = 42;
    delete task.stages.brief.visitCount;
    delete task.stages.brief.history;
    delete task.stages.brief.staleSince;
    writeFileSync(file, JSON.stringify(task, null, 2));

    const { readTask } = await import("./fsutil.js");
    const loaded = await readTask(file);
    assert.equal(
      loaded.stages.brief.visitCount,
      1,
      "done stage should get visitCount=1",
    );
    assert.deepEqual(loaded.stages.brief.history, []);
    assert.equal(loaded.stages.brief.staleSince, null);
    assert.equal(
      loaded.stages.plan.visitCount,
      0,
      "pending stage should get visitCount=0",
    );
  });
});

test("report shows visitCount and totalVisitSec for revisited stages", async () => {
  await withScratchCwd(async () => {
    const { cmdInit, cmdTaskNew } = await import("./scaffold.js");
    const { cmdStageStart, cmdStageEnd } = await import("./stage.js");
    const { buildReport } = await import("./report.js");
    await cmdInit({});
    await cmdTaskNew("Report revisit test", { sourceType: "adhoc" });
    const dir = path.join(
      process.cwd(),
      ".bob",
      "tasks",
      "T-000-report-revisit-test",
    );
    const { writeFileSync } = await import("node:fs");

    await cmdStageStart("plan", {});
    await new Promise((r) => setTimeout(r, 50));
    writeFileSync(path.join(dir, "02-plan.md"), "# Plan v1\n");
    await cmdStageEnd("plan", {});

    // Revisit plan.
    await cmdStageStart("plan", {});
    await new Promise((r) => setTimeout(r, 50));
    writeFileSync(path.join(dir, "02-plan.md"), "# Plan v2\n");
    await cmdStageEnd("plan", {});

    const r = await buildReport();
    const planStage = r.perStage.find((s) => s.stage === "plan")!;
    assert.equal(planStage.visitCount, 2, "plan should show visitCount=2");
    assert.ok(
      planStage.totalVisitSec !== null,
      "totalVisitSec should be non-null",
    );
    assert.ok(
      planStage.totalVisitSec! >= planStage.relaySec! ||
        planStage.relaySec === null,
      "totalVisitSec should be >= last durationSec alone",
    );
  });
});

test("task new populates a default-fallback estimatedBaseline; a baseline-mode task gets none", async () => {
  await withScratchCwd(async () => {
    const { cmdInit, cmdTaskNew } = await import("./scaffold.js");
    const { loadConfig } = await import("./paths.js");
    await cmdInit({});
    await cmdTaskNew("Widget", { sourceType: "adhoc" });

    const cfg = await loadConfig();
    const dir = path.join(
      process.cwd(),
      ".bob",
      "tasks",
      "T-000-widget",
    );
    const task = JSON.parse(readFileSync(path.join(dir, "task.json"), "utf8"));
    assert.equal(task.estimatedBaseline.method, "default-fallback");
    assert.equal(
      task.estimatedBaseline.totalSec,
      cfg.estimation?.defaultFallbackSec,
    );

    await cmdTaskNew("Manual timing run", {
      sourceType: "adhoc",
      baseline: true,
    });
    const baselineDir = path.join(
      process.cwd(),
      ".bob",
      "tasks",
      "T-001-manual-timing-run",
    );
    const baselineTask = JSON.parse(
      readFileSync(path.join(baselineDir, "task.json"), "utf8"),
    );
    assert.equal(baselineTask.estimatedBaseline, undefined);
  });
});

test("relay task estimate --method ai-estimated overwrites the placeholder", async () => {
  await withScratchCwd(async () => {
    const { cmdInit, cmdTaskNew } = await import("./scaffold.js");
    const { cmdTaskEstimate } = await import("./estimate.js");
    await cmdInit({});
    await cmdTaskNew("Widget", { sourceType: "adhoc" });

    await cmdTaskEstimate({
      method: "ai-estimated",
      totalSec: 5000,
      perStage: "brief=600,plan=1800",
      basedOn: "T-old",
    });

    const dir = path.join(
      process.cwd(),
      ".bob",
      "tasks",
      "T-000-widget",
    );
    const task = JSON.parse(readFileSync(path.join(dir, "task.json"), "utf8"));
    assert.equal(task.estimatedBaseline.method, "ai-estimated");
    assert.equal(task.estimatedBaseline.totalSec, 5000);
    assert.equal(task.estimatedBaseline.perStage.brief, 600);
    assert.equal(task.estimatedBaseline.perStage.plan, 1800);
    assert.equal(task.estimatedBaseline.basedOnSimilarTask, "T-old");
  });
});

test("relay compile computes a historical average from completed relay tasks; new tasks then use it as their fallback", async () => {
  await withScratchCwd(async () => {
    const { cmdInit, cmdTaskNew } = await import("./scaffold.js");
    const { resolveActiveTask } = await import("./active.js");
    const { saveTask } = await import("./fsutil.js");
    const { compileOnce } = await import("./compile.js");
    const { loadConfig } = await import("./paths.js");
    const { STAGES } = await import("./types.js");
    await cmdInit({});

    for (const total of [1000, 2000, 3000]) {
      await cmdTaskNew("Widget", { sourceType: "adhoc" });
      const { dir, task } = await resolveActiveTask();
      for (const s of STAGES) {
        task.stages[s].status = "done";
        task.stages[s].durationSec = 0;
      }
      task.stages.brief.durationSec = total;
      await saveTask(path.join(dir, "task.json"), task);
    }

    await compileOnce();
    const cfg = await loadConfig();
    assert.equal(cfg.estimation?.averageTicketDurationSec, 2000);

    await cmdTaskNew("Fourth widget", { sourceType: "adhoc" });
    const { task: fourth } = await resolveActiveTask();
    assert.equal(fourth.estimatedBaseline?.method, "historical-average");
    assert.equal(fourth.estimatedBaseline?.totalSec, 2000);
  });
});
