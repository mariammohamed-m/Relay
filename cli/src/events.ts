// Append-only writer/reader for .bob/metrics/events.jsonl, typed against
// the RelayEvent union in ./types.ts.
import { appendFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { ensureDir } from "./fsutil.js";
import { eventsFile } from "./paths.js";
import path from "node:path";
import type { RelayEvent } from "./types.js";

export async function appendEvent(event: RelayEvent): Promise<void> {
  const file = eventsFile();
  await ensureDir(path.dirname(file));
  await appendFile(file, JSON.stringify(event) + "\n", "utf8");
}

/**
 * Reads and parses every line of events.jsonl. Malformed lines are skipped
 * with a warning printed to stderr rather than aborting - a half-written
 * line during a live demo must not break compilation.
 */
export async function readEvents(): Promise<RelayEvent[]> {
  const file = eventsFile();
  if (!existsSync(file)) return [];
  const raw = await readFile(file, "utf8");
  const events: RelayEvent[] = [];
  const lines = raw.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const parsed = JSON.parse(line);
      if (!parsed || typeof parsed.event !== "string") {
        throw new Error('missing "event" field');
      }
      events.push(parsed as RelayEvent);
    } catch (err) {
      console.warn(
        `warning: skipping malformed events.jsonl line ${i + 1}: ${(err as Error).message}`,
      );
    }
  }
  return events;
}
