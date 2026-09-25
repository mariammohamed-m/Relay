#!/usr/bin/env node
// Copies the built dashboard (dashboard/dist) into cli/dashboard-dist so the
// visual dashboard ships inside the published npm package - see
// cli/package.json "files" and `relay dashboard`. Run as the last step of
// the root `npm run build`, after the dashboard workspace has built.
import { cp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cliDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.join(cliDir, "..");
const src = path.join(repoRoot, "dashboard", "dist");
const dest = path.join(cliDir, "dashboard-dist");

if (!existsSync(src)) {
  console.error(
    `${path.relative(repoRoot, src)} not found - run \`npm run build --workspace dashboard\` first.`,
  );
  process.exit(1);
}

await rm(dest, { recursive: true, force: true });
// relay-data.json in dashboard/dist is a stale build-time copy of this
// repo's own data - `relay dashboard` serves that route dynamically instead.
await cp(src, dest, {
  recursive: true,
  filter: (source) => path.basename(source) !== "relay-data.json",
});

console.log(`Copied dashboard build into ${path.relative(repoRoot, dest)}`);
