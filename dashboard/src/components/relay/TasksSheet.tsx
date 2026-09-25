import { useState } from "react";
import { InboxIcon, SearchXIcon } from "lucide-react";
import { STAGES, type CompiledTask, type StageStatus } from "@/lib/types";
import { allTags, sortedFilteredTasks } from "@/lib/taskList";
import { formatRelativeTime, formatTimestamp } from "@/lib/format";
import { stageLabel } from "@/lib/stageLabel";
import { Sheet } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { StatusIcon } from "./StatusIcon";
import { EmptyState } from "./EmptyState";
import { cn } from "@/lib/utils";

// Same status vocabulary as StatusIcon/CriteriaCoverage, condensed into a
// segmented strip per task row - one flush segment per pipeline stage.
const STAGE_SEGMENT: Record<StageStatus, string> = {
  done: "bg-ok",
  running: "bg-accent",
  failed: "bg-bad",
  skipped: "bg-line-strong",
  pending: "bg-raised",
};

function StageStrip({ task }: { task: CompiledTask }) {
  return (
    <div className="mt-1.5 flex h-1 gap-0.5 overflow-hidden rounded-full" aria-hidden>
      {STAGES.map((stage) => (
        <span
          key={stage}
          className={cn("flex-1", STAGE_SEGMENT[task.stages[stage].status])}
        />
      ))}
    </div>
  );
}

interface TasksSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: CompiledTask[];
  activeTaskId: string;
  onSelect: (taskId: string) => void;
}

export function TasksSheet({
  open,
  onOpenChange,
  tasks,
  activeTaskId,
  onSelect,
}: TasksSheetProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const tags = allTags(tasks);
  const visible = sortedFilteredTasks(tasks, selectedTags);

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      side="left"
      title="Tasks"
      description={`${visible.length} of ${tasks.length}`}
    >
      <div className="space-y-4">
        {tags.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[11px] font-medium text-subtle">
                Filter by tag
              </h3>
              {selectedTags.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedTags([])}
                  className="text-[11px] text-accent hover:underline"
                >
                  clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      "rounded-full border px-2 py-0.5 font-mono text-[11px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                      active
                        ? "border-accent/30 bg-accent/10 text-accent"
                        : "border-line bg-surface text-muted hover:bg-raised",
                    )}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {tasks.length === 0 ? (
          <EmptyState
            icon={InboxIcon}
            title="No tasks yet"
            description="Once `relay task new` creates a task and `relay compile` runs, it will show up here."
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={SearchXIcon}
            title="No tasks match this filter"
            description="Clear the tag filter to see every task."
          />
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((t) => {
              const isActive = t.id === activeTaskId;
              const current = t.stages[t.currentStage];
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    aria-current={isActive ? "true" : undefined}
                    onClick={() => {
                      onSelect(t.id);
                      onOpenChange(false);
                    }}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-md px-2.5 py-3 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
                      isActive ? "bg-raised" : "hover:bg-raised/60",
                    )}
                  >
                    <StatusIcon status={current.status} size="sm" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] text-muted">
                          {t.id}
                        </span>
                        <span className="truncate text-sm text-fg">
                          {t.title}
                        </span>
                        {t.mode === "baseline" && (
                          <Badge variant="subtle">baseline</Badge>
                        )}
                      </div>
                      {t.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {t.tags.map((tag) => (
                            <Badge key={tag}>{tag}</Badge>
                          ))}
                        </div>
                      )}
                      <p className="text-[11px] text-subtle">
                        {stageLabel(t.currentStage)} · {current.status}
                      </p>
                      <p className="font-mono text-[11px] text-subtle">
                        <span title={formatTimestamp(t.createdAt)}>
                          created {formatRelativeTime(t.createdAt)}
                        </span>
                        {" · "}
                        <span title={formatTimestamp(t.lastEditedAt)}>
                          edited {formatRelativeTime(t.lastEditedAt)}
                        </span>
                      </p>
                      <StageStrip task={t} />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
