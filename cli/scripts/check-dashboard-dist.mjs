#!/usr/bin/env node
// Guards `npm publish` from shipping without the bundled dashboard - run
// `npm run build` from the repo root first, which populates dashboard-dist/
// via copy-dashboard-dist.mjs.
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cliDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const marker = path.join(cliDir, "dashboard-dist", "index.html");

if (!existsSync(marker)) {
  console.error(
    "dashboard-dist/ is missing or incomplete - run `npm run build` from the repo root (not just cli/) before publishing.",
  );
  process.exit(1);
}
