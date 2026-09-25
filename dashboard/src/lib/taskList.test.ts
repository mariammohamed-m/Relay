// Pure-function tests for the tasks sheet's sort/filter logic - run directly
// via `node --experimental-strip-types` (Node 22+), no bundler or test
// framework needed since these functions have no React/DOM dependency.
import { test } from "node:test";
import assert from "node:assert/strict";
import { allTags, sortedFilteredTasks } from "./taskList.ts";
import { artifactDownloadName, formatRelativeTime } from "./format.ts";

function task(id: string, createdAt: string, tags: string[]) {
  return { id, createdAt, tags } as any;
}

test("sortedFilteredTasks sorts newest-created-first", () => {
  const tasks = [
    task("T-000", "2026-01-01T00:00:00Z", []),
    task("T-002", "2026-03-01T00:00:00Z", []),
    task("T-001", "2026-02-01T00:00:00Z", []),
  ];
  const sorted = sortedFilteredTasks(tasks, []);
  assert.deepEqual(sorted.map((t) => t.id), ["T-002", "T-001", "T-000"]);
});

test("sortedFilteredTasks filters to tasks with ANY selected tag, without reordering", () => {
  const tasks = [
    task("T-000", "2026-01-01T00:00:00Z", ["alpha"]),
    task("T-002", "2026-03-01T00:00:00Z", ["beta"]),
    task("T-001", "2026-02-01T00:00:00Z", ["alpha", "beta"]),
  ];
  const filtered = sortedFilteredTasks(tasks, ["beta"]);
  assert.deepEqual(filtered.map((t) => t.id), ["T-002", "T-001"]);
});

test("allTags dedupes and sorts across every task", () => {
  const tasks = [task("T-000", "2026-01-01T00:00:00Z", ["b", "a"]), task("T-001", "2026-01-02T00:00:00Z", ["a", "c"])];
  assert.deepEqual(allTags(tasks), ["a", "b", "c"]);
});

test("artifactDownloadName joins task id and artifact filename", () => {
  assert.equal(artifactDownloadName("T-001", "01-brief.md"), "T-001-01-brief.md");
});

test("formatRelativeTime renders minutes/hours ago", () => {
  const now = Date.parse("2026-01-01T01:00:00Z");
  assert.equal(formatRelativeTime("2026-01-01T00:55:00Z", now), "5 mins ago");
  assert.equal(formatRelativeTime("2025-12-31T23:00:00Z", now), "2 hours ago");
});
