import type { StageStatus } from "@/lib/types";

export function formatDuration(sec: number | null): string {
  if (sec === null) return "-";
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

export function formatMinutes(min: number): string {
  if (min < 1) return `${Math.round(min * 60)}s`;
  if (min < 60) return `${Math.round(min)}m`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export const statusLabel: Record<StageStatus, string> = {
  pending: "Pending",
  running: "Running",
  done: "Done",
  skipped: "Skipped",
  failed: "Failed",
};

export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "3 min ago" / "2 hours ago" / "5 days ago" style relative time, for the tasks sheet's created/last-edited columns. */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const diffSec = Math.round((now - new Date(iso).getTime()) / 1000);
  if (diffSec < 5) return "just now";
  const units: [string, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["min", 60],
    ["sec", 1],
  ];
  for (const [label, secs] of units) {
    const value = Math.floor(diffSec / secs);
    if (value >= 1) return `${value} ${label}${value === 1 ? "" : "s"} ago`;
  }
  return "just now";
}

/** Filename for an artifact download: `<task-id>-<artifact-filename>`, e.g. `T-001-01-brief.md`. */
export function artifactDownloadName(taskId: string, artifactFilename: string): string {
  return `${taskId}-${artifactFilename}`;
}
