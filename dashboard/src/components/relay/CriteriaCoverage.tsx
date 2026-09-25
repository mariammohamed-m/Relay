import { AlertTriangleIcon, CheckCircle2Icon, CircleIcon } from "lucide-react";
import type { AcceptanceCriterion, Task } from "@/lib/types";
import { Panel } from "./Panel";
import { EmptyState } from "./EmptyState";
import { cn } from "@/lib/utils";

type RowState = "covered" | "uncovered" | "untestable";

function rowState(c: AcceptanceCriterion): RowState {
  if (!c.testable) return "untestable";
  return c.covered ? "covered" : "uncovered";
}

const STATE_META: Record<
  RowState,
  {
    label: string;
    icon: typeof CheckCircle2Icon;
    text: string;
    segment: string;
  }
> = {
  covered: {
    label: "Covered",
    icon: CheckCircle2Icon,
    text: "text-ok",
    segment: "bg-ok",
  },
  uncovered: {
    label: "Not covered",
    icon: CircleIcon,
    text: "text-subtle",
    segment: "bg-raised",
  },
  untestable: {
    label: "Too ambiguous to test",
    icon: AlertTriangleIcon,
    text: "text-warn",
    segment: "bg-warn",
  },
};

interface CriteriaCoverageProps {
  task: Task;
}

// Relay's novel contribution - the coverage count is deliberately the
// largest number in this panel, not a footnote. "Uncovered" is rendered as
// a distinct, neutral third state (muted gray, a hollow circle) rather than
// as failure red: it's an honest gap, not a bug.
export function CriteriaCoverage({ task }: CriteriaCoverageProps) {
  const criteria = task.acceptanceCriteria;
  const covered = criteria.filter((c) => rowState(c) === "covered").length;
  const untestable = criteria.filter(
    (c) => rowState(c) === "untestable",
  ).length;

  return (
    <Panel title="Acceptance criteria" meta="from the brief">
      {criteria.length === 0 ? (
        <EmptyState
          icon={CircleIcon}
          title="No criteria extracted yet"
          description="Criteria appear here once the brief stage reads the ticket."
        />
      ) : (
        <div>
          <div className="mb-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-fg">
                {covered} of {criteria.length}
              </span>
              <span className="text-sm text-muted">criteria covered</span>
              {untestable > 0 && (
                <span className="ml-auto text-xs text-warn">
                  {untestable} flagged ambiguous
                </span>
              )}
            </div>
            <div
              className="mt-2 flex h-1.5 gap-0.5 overflow-hidden rounded-full"
              aria-hidden
            >
              {criteria.map((c) => (
                <span
                  key={c.id}
                  className={cn("flex-1", STATE_META[rowState(c)].segment)}
                />
              ))}
            </div>
          </div>

          <ul className="divide-y divide-line">
            {criteria.map((c) => {
              const state = rowState(c);
              const meta = STATE_META[state];
              const Icon = meta.icon;
              return (
                <li key={c.id} className="flex gap-3 py-2.5">
                  <Icon
                    className={cn("mt-0.5 h-4 w-4 shrink-0", meta.text)}
                    aria-label={meta.label}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span
                        className="whitespace-nowrap font-mono text-[11px] text-subtle"
                        title={c.source}
                      >
                        {c.id}
                      </span>
                      <span className="text-sm text-fg">{c.text}</span>
                    </div>
                    <div
                      className={cn(
                        "mt-0.5 text-xs",
                        c.testRef ? "font-mono text-muted" : meta.text,
                      )}
                    >
                      {state === "covered" && c.testRef}
                      {state === "uncovered" && "Not covered - no test yet"}
                      {state === "untestable" && (
                        <>
                          Ambiguous as written
                          {c.ambiguityNote && (
                            <>
                              {" "}
                              · Proposed rewrite:{" "}
                              <span className="text-muted">
                                {c.ambiguityNote}
                              </span>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Panel>
  );
}
