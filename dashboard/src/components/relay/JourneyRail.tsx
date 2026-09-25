import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DownloadIcon, FileTextIcon, HistoryIcon, AlertTriangleIcon, RefreshCwIcon, GitMergeIcon } from "lucide-react";
import { STAGES, type StageId, type StageVisit, type Task } from "@/lib/types";
import { stageLabel } from "@/lib/stageLabel";
import { formatDuration, formatTimestamp, artifactDownloadName } from "@/lib/format";
import { isStubArtifact } from "@/lib/artifact";
import { StatusIcon } from "./StatusIcon";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "./EmptyState";
import { cn } from "@/lib/utils";

interface JourneyRailProps {
  task: Task;
}

function downloadArtifact(taskId: string, artifact: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = artifactDownloadName(taskId, artifact);
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Version selector + content display for a stage that has been visited more
 * than once. "latest" shows the current artifact; numeric keys show a history
 * entry read-only with its changeSummary.
 */
function ArtifactVersionViewer({
  latestContent,
  history,
}: {
  latestContent: string | null | undefined;
  history: StageVisit[] | undefined;
}) {
  const visits = history ?? [];
  const [selected, setSelected] = useState<"latest" | number>("latest");

  const options: Array<{ label: string; value: "latest" | number }> = [
    { label: "Latest", value: "latest" },
    ...visits.map((v) => ({ label: `Visit ${v.visitNumber}`, value: v.visitNumber })),
  ];

  const currentContent =
    selected === "latest"
      ? latestContent
      : visits.find((v) => v.visitNumber === selected)?.artifactSnapshot ?? null;

  const currentSummary =
    selected !== "latest"
      ? visits.find((v) => v.visitNumber === selected)?.changeSummary ?? null
      : null;

  return (
    <div className="space-y-3">
      {options.length > 1 && (
        <div className="flex items-center gap-2">
          <label
            htmlFor="artifact-version-select"
            className="text-xs text-muted"
          >
            Version:
          </label>
          <select
            id="artifact-version-select"
            value={selected}
            onChange={(e) => {
              const val = e.target.value;
              setSelected(val === "latest" ? "latest" : Number(val));
            }}
            className="rounded border border-line bg-surface px-2 py-1 text-xs text-fg focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {options.map((o) => (
              <option key={String(o.value)} value={String(o.value)}>
                {o.label}
              </option>
            ))}
          </select>
          {selected !== "latest" && (
            <span className="text-xs text-muted">(read-only historical snapshot)</span>
          )}
        </div>
      )}

      {currentSummary && (
        <div className="rounded border border-line bg-raised px-3 py-2 font-mono text-xs text-muted">
          <span className="font-medium text-fg">Changes from this visit: </span>
          {currentSummary}
        </div>
      )}

      {currentContent ? (
        <div className={cn("md-artifact", selected !== "latest" && "opacity-80")}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {currentContent}
          </ReactMarkdown>
        </div>
      ) : (
        <EmptyState
          icon={FileTextIcon}
          title="No artifact content"
          description={
            selected === "latest"
              ? "This stage completed, but no markdown body was compiled in for it."
              : "No snapshot was captured for this visit."
          }
        />
      )}
    </div>
  );
}

// The hero component. All nine canonical stages, sourced from STAGES so the
// order can never drift from the data contract. Stays legible with all nine
// nodes at 1440px (fits comfortably inside the 960px min-width the row
// needs) and degrades to horizontal scroll below ~900-960px.
export function JourneyRail({ task }: JourneyRailProps) {
  const [openStage, setOpenStage] = useState<StageId | null>(null);
  const [failedStage, setFailedStage] = useState<StageId | null>(null);
  const hasConflicts = Boolean(task.conflictCheck?.hasConflicts);
  const doneCount = STAGES.filter(
    (id) => task.stages[id].status === "done",
  ).length;
  const openRecord = openStage ? task.stages[openStage] : null;
  const failedRecord = failedStage ? task.stages[failedStage] : null;

  return (
    <section
      className="rounded-lg border border-line bg-surface"
      aria-labelledby="journey-heading"
    >
      <div className="flex items-baseline justify-between border-b border-line px-5 py-3">
        <h2 id="journey-heading" className="text-sm font-medium text-fg">
          Journey
        </h2>
        <span className="font-mono text-xs text-muted">
          {doneCount} of {STAGES.length} done
        </span>
      </div>

      <div className="overflow-x-auto p-3">
        <ol className="grid min-w-[960px] grid-cols-9 gap-1">
          {STAGES.map((id, i) => {
            const record = task.stages[id];
            const last = i === STAGES.length - 1;
            const clickableDone =
              record.status === "done" &&
              !isStubArtifact(id, record.content ?? null);
            const clickableFailed = record.status === "failed";
            const clickable = clickableDone || clickableFailed;
            const visitCount = record.visitCount ?? 0;
            const isRevisited = visitCount > 1;
            const isStale = Boolean(record.staleSince);
            return (
              <li key={id} className="relative">
                {!last && (
                  <span
                    className={cn(
                      "absolute left-[calc(50%+14px)] right-[calc(-50%+14px)] top-[26px] h-px",
                      record.status === "done" ? "bg-ok/50" : "bg-line",
                    )}
                    aria-hidden
                  />
                )}
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => {
                    if (clickableDone) setOpenStage(id);
                    else if (clickableFailed) setFailedStage(id);
                  }}
                  aria-label={`${stageLabel(id)}, ${record.status}${
                    isStale ? " (may be stale)" : ""
                  }${
                    clickableFailed
                      ? ` - ${record.failure?.reason ?? "failed"}`
                      : clickableDone
                        ? " - open artifact"
                        : ""
                  }`}
                  title={
                    isStale
                      ? `Stale since ${formatTimestamp(record.staleSince!)}: an upstream stage was revisited after this one completed. Re-run this stage to clear.`
                      : clickableFailed
                        ? `${record.failure?.reason ?? "Failed"}${record.failure?.at ? ` (${formatTimestamp(record.failure.at)})` : ""}`
                        : undefined
                  }
                  className={cn(
                    "relative flex w-full flex-col items-center gap-2 rounded-md px-2 pb-3 pt-4 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    clickable
                      ? "cursor-pointer hover:bg-raised/60"
                      : "cursor-default",
                    record.status === "running" &&
                      "bg-accent/10 ring-1 ring-accent/30",
                    isStale && record.status !== "running" &&
                      "ring-1 ring-warn/40",
                  )}
                >
                  <span className="grid h-5 place-items-center">
                    <StatusIcon status={record.status} />
                  </span>
                  <span
                    className={cn(
                      "text-sm",
                      record.status === "pending"
                        ? "text-subtle"
                        : record.status === "running"
                          ? "font-medium text-fg"
                          : record.status === "failed"
                            ? "font-medium text-bad"
                            : "text-muted",
                    )}
                  >
                    {stageLabel(id)}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[11px]",
                      record.status === "running"
                        ? "text-accent"
                        : record.status === "failed"
                          ? "text-bad"
                          : "text-subtle",
                    )}
                  >
                    {record.status === "running"
                      ? "running"
                      : record.status === "skipped"
                        ? "skipped"
                        : record.status === "failed"
                          ? "failed"
                          : formatDuration(record.durationSec)}
                  </span>
                  {record.status === "running" && (
                    <span
                      className="absolute right-2 top-1 h-1.5 w-1.5 rounded-full bg-accent motion-safe:animate-pulse"
                      aria-hidden
                    />
                  )}
                  {/* Revisit badge: shown when a stage was visited more than once */}
                  {isRevisited && (
                    <span
                      className="absolute left-1 top-1 flex items-center gap-0.5 rounded-full bg-accent/15 px-1.5 py-0.5 font-mono text-[10px] text-accent"
                      title={`Revisited ${visitCount} times`}
                      aria-label={`Revisited ${visitCount} times`}
                    >
                      <RefreshCwIcon className="h-2.5 w-2.5" aria-hidden />
                      ×{visitCount}
                    </span>
                  )}
                  {/* Stale indicator: shown when a downstream stage may be out of date */}
                  {isStale && (
                    <span
                      className="absolute right-1 top-1 flex items-center gap-0.5 rounded-full bg-warn/15 px-1 py-0.5 font-mono text-[10px] text-warn"
                      aria-label="Stale: an upstream stage was revisited"
                    >
                      <AlertTriangleIcon className="h-2.5 w-2.5" aria-hidden />
                    </span>
                  )}
                  {/* Conflict warning: shown on the pr node when check-conflicts found conflicts */}
                  {id === "pr" && hasConflicts && (
                    <span
                      className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded-full bg-orange-500/15 px-1.5 py-0.5 font-mono text-[10px] text-orange-600 dark:text-orange-400"
                      title={`${task.conflictCheck!.files.length} merge conflict(s) against ${task.conflictCheck!.baseBranch}`}
                      aria-label={`Merge conflicts: ${task.conflictCheck!.files.length} file(s) conflict with ${task.conflictCheck!.baseBranch}`}
                    >
                      <GitMergeIcon className="h-2.5 w-2.5" aria-hidden />
                      {task.conflictCheck!.files.length}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <Dialog
        open={openStage !== null}
        onOpenChange={(open) => !open && setOpenStage(null)}
        title={openStage ? `${stageLabel(openStage)} · ${task.title}` : ""}
        description={
          openRecord && (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono">
              <span>{openRecord.artifact}</span>
              {openRecord.artifactMtime && (
                <span>· modified {formatTimestamp(openRecord.artifactMtime)}</span>
              )}
              {openRecord.restoredAt && (
                <span className="flex items-center gap-1 text-warn">
                  <HistoryIcon className="h-3 w-3" aria-hidden />
                  restored from earlier version ({formatTimestamp(openRecord.restoredAt)})
                </span>
              )}
              {(openRecord.visitCount ?? 0) > 1 && (
                <span className="flex items-center gap-1 text-accent">
                  <RefreshCwIcon className="h-3 w-3" aria-hidden />
                  {openRecord.visitCount} visits · {(openRecord.history?.length ?? 0)} older version(s) in history
                </span>
              )}
              {openRecord.staleSince && (
                <span className="flex items-center gap-1 text-warn">
                  <AlertTriangleIcon className="h-3 w-3" aria-hidden />
                  stale since {formatTimestamp(openRecord.staleSince)}
                </span>
              )}
            </span>
          )
        }
        footer={
          <>
            {openRecord?.content && openStage && (
              <button
                type="button"
                onClick={() =>
                  downloadArtifact(task.id, openRecord.artifact ?? "", openRecord.content ?? "")
                }
                className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs text-fg transition-colors duration-150 hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <DownloadIcon className="h-3.5 w-3.5" aria-hidden />
                Download
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpenStage(null)}
              className="rounded-md border border-line px-3 py-1.5 text-xs text-muted transition-colors duration-150 hover:bg-raised hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Close
            </button>
          </>
        }
      >
        {openStage === "pr" && hasConflicts && (
          <div className="mb-4 rounded-md border border-orange-400/40 bg-orange-500/10 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-orange-600 dark:text-orange-400">
              <GitMergeIcon className="h-4 w-4 shrink-0" aria-hidden />
              ⚠ Merge conflicts detected — {task.conflictCheck!.files.length} file(s) conflict with{" "}
              <code className="rounded bg-orange-500/15 px-1 font-mono text-[11px]">
                {task.conflictCheck!.baseBranch}
              </code>
            </div>
            {task.conflictCheck!.files.length > 0 && (
              <ul className="mt-2 space-y-0.5 pl-6 font-mono text-xs text-orange-700 dark:text-orange-300">
                {task.conflictCheck!.files.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted">
              Checked {formatTimestamp(task.conflictCheck!.checkedAt)}. This branch cannot be merged
              until these conflicts are resolved.
            </p>
          </div>
        )}
        <ArtifactVersionViewer
          latestContent={openRecord?.content}
          history={openRecord?.history}
        />
      </Dialog>

      <Dialog
        open={failedStage !== null}
        onOpenChange={(open) => !open && setFailedStage(null)}
        title={failedStage ? `${stageLabel(failedStage)} failed` : ""}
        footer={
          <button
            type="button"
            onClick={() => setFailedStage(null)}
            className="rounded-md border border-line px-3 py-1.5 text-xs text-muted transition-colors duration-150 hover:bg-raised hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Close
          </button>
        }
      >
        <div className="space-y-3 text-sm">
          <p className="text-fg">
            {failedRecord?.failure?.reason ?? "This stage was cancelled and had no usable prior version to restore."}
          </p>
          {failedRecord?.failure?.at && (
            <p className="font-mono text-xs text-subtle">
              {formatTimestamp(failedRecord.failure.at)}
            </p>
          )}
          <p className="text-muted">Re-run this stage in Bob to clear the failure.</p>
        </div>
      </Dialog>
    </section>
  );
}
