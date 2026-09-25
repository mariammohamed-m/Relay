import type { ReactNode } from "react";
import { FileTextIcon, FileCheckIcon } from "lucide-react";
import type { KnowledgeEntry, StageId, Task } from "@/lib/types";
import { STAGES } from "@/lib/types";
import { stageLabel } from "@/lib/stageLabel";
import { Panel } from "./Panel";

interface BatonPanelProps {
  task: Task;
  knowledge: KnowledgeEntry[];
}

// What Bob currently knows for the active task, laid out so the user can
// audit the agent's context instead of guessing at it. Everything here is
// a direct read of a RelayData field - no derived numbers beyond comparing
// two real timestamps (discoveredAt vs. createdAt) to say what was already
// in the knowledge base by the time this task started.
export function BatonPanel({ task, knowledge }: BatonPanelProps) {
  const artifacts = STAGES.filter(
    (id: StageId) => task.stages[id].artifact !== null,
  );
  const availableAtOnboard = knowledge.filter(
    (k) => new Date(k.discoveredAt) < new Date(task.createdAt),
  );
  const harvested = knowledge.filter((k) =>
    task.knowledgeHarvested.includes(k.id),
  );

  return (
    <Panel title="Bob's context" meta="what the agent can see">
      <div className="space-y-5">
        <Group icon={FileTextIcon} label="Artifacts written">
          {artifacts.length === 0 ? (
            <EmptyRow>None yet</EmptyRow>
          ) : (
            <ul className="space-y-1">
              {artifacts.map((id) => (
                <li
                  key={id}
                  className="flex items-baseline justify-between gap-3 font-mono text-xs"
                >
                  <span className="text-fg/90">{stageLabel(id)}</span>
                  <span className="truncate text-subtle">
                    {task.stages[id].artifact}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Group>

        <Group icon={FileCheckIcon} label="Acceptance criteria">
          <p className="text-xs text-muted">
            {task.acceptanceCriteria.length} criteria in scope, extracted from{" "}
            <span className="font-mono text-subtle">{task.source.ref}</span>
          </p>
        </Group>

        <Group label="Knowledge in scope">
          <div className="space-y-3">
            <div>
              <h5 className="mb-1 text-[11px] text-subtle">
                Available at onboarding ({availableAtOnboard.length})
              </h5>
              {availableAtOnboard.length === 0 ? (
                <EmptyRow>
                  Nothing in the knowledge base yet at task creation
                </EmptyRow>
              ) : (
                <ul className="space-y-1">
                  {availableAtOnboard.map((k) => (
                    <li
                      key={k.id}
                      className="truncate font-mono text-xs text-fg/90"
                      title={k.title}
                    >
                      {k.id} <span className="text-subtle">· {k.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h5 className="mb-1 text-[11px] text-subtle">
                Harvested this task ({harvested.length})
              </h5>
              {harvested.length === 0 ? (
                <EmptyRow>Nothing harvested yet</EmptyRow>
              ) : (
                <ul className="space-y-1">
                  {harvested.map((k) => (
                    <li
                      key={k.id}
                      className="truncate font-mono text-xs text-accent"
                      title={k.title}
                    >
                      {k.id} <span className="text-muted">· {k.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Group>

        <Group label="Files touched">
          {task.filesTouched.length === 0 ? (
            <EmptyRow>No files touched yet</EmptyRow>
          ) : (
            <ul className="space-y-1">
              {task.filesTouched.map((f) => (
                <li key={f} className="truncate font-mono text-xs text-fg/90">
                  {f}
                </li>
              ))}
            </ul>
          )}
        </Group>
      </div>
    </Panel>
  );
}

function Group({
  icon: Icon,
  label,
  children,
}: {
  icon?: typeof FileTextIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-subtle">
        {Icon && <Icon className="h-3 w-3" aria-hidden />}
        {label}
      </h4>
      {children}
    </div>
  );
}

function EmptyRow({ children }: { children: ReactNode }) {
  return <p className="text-xs text-subtle">{children}</p>;
}
