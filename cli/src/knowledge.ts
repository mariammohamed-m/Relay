// Tolerant parser for .bob/relay/knowledge/gotchas.md into KnowledgeEntry[].
// Matches on "## gotcha-NNN - Title" headings and bolded "- **field:** value"
// lines. Missing fields become null rather than throwing - the file is
// hand/Bob-written prose, not a strict format.
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { gotchasFile } from "./paths.js";
import type { KnowledgeEntry } from "./types.js";

const FIELD_KEYS: Record<string, keyof KnowledgeEntry> = {
  discoveredin: "discoveredIn",
  discoveredat: "discoveredAt",
  costminutes: "costMinutes",
  symptom: "symptom",
  rootcause: "rootCause",
  fix: "fix",
  watchout: "watchOut",
  coderefs: "codeRefs",
  stalenesscheck: "stalenessCheck",
};

export function existsInGotchasText(text: string, id: string): boolean {
  return new RegExp(`^##\\s+${escapeRegExp(id)}\\b`, "m").test(text);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function readGotchasFile(): Promise<string> {
  const file = gotchasFile();
  if (!existsSync(file)) return "";
  return readFile(file, "utf8");
}

export function parseGotchas(text: string): KnowledgeEntry[] {
  const entries: KnowledgeEntry[] = [];
  // Split on top-level "## gotcha-xxx" headings.
  const sections = text.split(/^##\s+/m).slice(1);

  for (const section of sections) {
    const headingLine = section.split("\n", 1)[0] ?? "";
    const idMatch = headingLine.match(/^(gotcha-[\w-]+)/i);
    if (!idMatch) continue; // not a gotcha heading (e.g. "## Gotchas" itself)
    const id = idMatch[1];
    const titleMatch = headingLine.match(/-\s*(.+)$/);
    const title = titleMatch
      ? titleMatch[1].trim()
      : headingLine.replace(id, "").trim();

    const entry: Partial<KnowledgeEntry> = {
      id,
      title,
      discoveredIn: null as unknown as string,
      discoveredAt: null as unknown as string,
      costMinutes: null as unknown as number,
      symptom: null as unknown as string,
      rootCause: null as unknown as string,
      fix: null as unknown as string,
      watchOut: null as unknown as string,
      codeRefs: [],
      stalenessCheck: null as unknown as string,
    };

    // Bulleted "- **field:** value" lines, tolerant of multi-line wraps
    // (continuation lines are indented and don't start a new "- **" or "##").
    const lines = section.split("\n");
    let currentKey: keyof KnowledgeEntry | null = null;
    let buffer: string[] = [];
    const flush = () => {
      if (!currentKey) return;
      const value = buffer.join(" ").trim();
      if (currentKey === "costMinutes") {
        const n = Number(value.match(/\d+/)?.[0]);
        (entry as any)[currentKey] = Number.isFinite(n) ? n : null;
      } else if (currentKey === "codeRefs") {
        (entry as any)[currentKey] = value
          .split(",")
          .map((s) => s.replace(/`/g, "").trim())
          .filter(Boolean);
      } else {
        (entry as any)[currentKey] = value || null;
      }
      buffer = [];
    };
    for (const line of lines) {
      const fieldMatch = line.match(/^- \*\*([\w ]+?):\*\*\s*(.*)$/);
      if (fieldMatch) {
        flush();
        currentKey =
          FIELD_KEYS[fieldMatch[1].trim().toLowerCase().replace(/\s+/g, "")] ??
          null;
        if (currentKey) buffer.push(fieldMatch[2]);
      } else if (currentKey && /^\s+\S/.test(line)) {
        buffer.push(line.trim());
      } else if (currentKey && line.trim() === "") {
        // blank line ends the current field's continuation
        flush();
        currentKey = null;
      }
    }
    flush();

    entries.push(entry as KnowledgeEntry);
  }

  return entries;
}
