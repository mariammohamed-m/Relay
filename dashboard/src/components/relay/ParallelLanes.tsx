import type { StageId, SubagentLane, Task } from "@/lib/types";
import { STAGES } from "@/lib/types";
import { stageLabel } from "@/lib/stageLabel";
import { formatDuration } from "@/lib/format";
import { Panel } from "./Panel";
import { cn } from "@/lib/utils";

interface ParallelLanesProps {
  task: Task;
}

/**
 * Only renders (and only takes up layout space) for stages that actually
 * have subagent events - most stages run no subagents at all, and this
 * whole panel is absent for a task where none did. Each stage gets its own
 * time axis (lanes within a stage genuinely run concurrently; lanes across
 * two different stages, hours apart, would not).
 */
export function ParallelLanes({ task }: ParallelLanesProps) {
  const stagesWithLanes = STAGES.filter(
    (id) => (task.stages[id].subagents?.length ?? 0) > 0,
  );
  if (stagesWithLanes.length === 0) return null;

  return (
    <Panel title="Parallel subagents" meta="concurrent work within a stage">
      <div className="space-y-6">
        {stagesWithLanes.map((id) => (
          <StageLaneGroup
            key={id}
            stageId={id}
            lanes={task.stages[id].subagents as SubagentLane[]}
          />
        ))}
      </div>
    </Panel>
  );
}

function StageLaneGroup({
  stageId,
  lanes,
}: {
  stageId: StageId;
  lanes: SubagentLane[];
}) {
  const base = Math.min(...lanes.map((a) => new Date(a.startedAt).getTime()));
  const withOffsets = lanes.map((a) => {
    const startSec = (new Date(a.startedAt).getTime() - base) / 1000;
    const running = a.completedAt === null;
    const durationSec =
      a.durationSec ??
      (running ? (Date.now() - new Date(a.startedAt).getTime()) / 1000 : 0);
    return { ...a, startSec, durationSec, running };
  });
  const span = Math.max(
    ...withOffsets.map((a) => a.startSec + a.durationSec),
    1,
  );

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-fg">{stageLabel(stageId)}</h3>
        <span className="text-xs text-subtle">{lanes.length} subagents</span>
      </div>
      <ul className="space-y-2">
        {withOffsets.map((a) => {
          const left = (a.startSec / span) * 100;
          const width = Math.max((a.durationSec / span) * 100, 1);
          return (
            <li
              key={a.name}
              className="grid grid-cols-[200px_minmax(0,1fr)_56px] items-center gap-3"
            >
              <div className="truncate font-mono text-xs text-fg">{a.name}</div>
              <div className="relative h-2 rounded-full bg-raised">
                <div
                  className={cn(
                    "absolute inset-y-0 rounded-full",
                    a.running
                      ? "bg-accent motion-safe:animate-pulse"
                      : "bg-accent/50",
                  )}
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              </div>
              <div
                className={cn(
                  "text-right font-mono text-[11px]",
                  a.running ? "text-accent" : "text-muted",
                )}
              >
                {a.running ? "live" : formatDuration(a.durationSec)}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 grid grid-cols-[200px_minmax(0,1fr)_56px] gap-3 font-mono text-[10px] text-subtle">
        <span />
        <div className="flex justify-between">
          <span>0s</span>
          <span>{formatDuration(Math.round(span / 2))}</span>
          <span>{formatDuration(Math.round(span))}</span>
        </div>
        <span />
      </div>
    </div>
  );
}
