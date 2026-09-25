import { BarChart3Icon } from "lucide-react";
import type { ImpactSummary } from "@/lib/types";
import { formatMinutes } from "@/lib/format";
import { stageLabel } from "@/lib/stageLabel";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "./EmptyState";

interface ImpactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  impact: ImpactSummary;
}

// Same comparison ImpactPanel used to render inline, moved into a dialog so
// it stops eating main-layout space. Bar logic unchanged: a `line-strong`
// reference bar (manual) with a shorter `accent` bar (measured Relay (Bob)
// time) drawn over it. Never renders a bar for a stage with no manual run -
// that would either fabricate a comparison or draw a zero-width bar that
// reads as "instant," neither of which is true.
export function ImpactDialog({ open, onOpenChange, impact }: ImpactDialogProps) {
  const withBaseline = impact.perStage.filter((s) => s.baselineSec !== null);
  const total = impact.perStage.length;

  if (withBaseline.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange} title="Impact" description="per stage">
        <EmptyState
          icon={BarChart3Icon}
          title="No baseline recorded"
          description="Run a manual baseline for this task's stages to see relay-vs-manual time comparisons here."
        />
      </Dialog>
    );
  }

  const maxSec = Math.max(...withBaseline.map((s) => s.baselineSec ?? 0));
  const hasTotals =
    impact.totalRelaySec !== null && impact.totalBaselineSec !== null;
  const savedSec = hasTotals
    ? (impact.totalBaselineSec as number) - (impact.totalRelaySec as number)
    : null;
  const pctSaved =
    hasTotals && impact.totalBaselineSec
      ? Math.round(
          ((savedSec as number) / (impact.totalBaselineSec as number)) * 100,
        )
      : null;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Impact"
      description="Manual vs Relay (Bob) time"
    >
      {withBaseline.length < total && (
        <p className="mb-4 text-xs text-subtle">
          Baseline recorded for {withBaseline.length} of {total} stages - only
          those are shown below.
        </p>
      )}

      {hasTotals && (
        <div className="mb-5 flex flex-wrap items-end gap-x-8 gap-y-2">
          <div>
            <div className="text-2xl font-semibold text-fg">
              {formatMinutes((savedSec as number) / 60)}
              {pctSaved !== null && (
                <span className="ml-1.5 text-sm font-normal text-ok">
                  ({pctSaved}%)
                </span>
              )}
            </div>
            <div className="text-xs text-muted">
              saved across measured stages
            </div>
          </div>
          <div className="font-mono text-xs text-muted">
            <span className="text-accent">
              {formatMinutes((impact.totalRelaySec as number) / 60)}
            </span>{" "}
            with Relay (Bob) vs{" "}
            <span className="text-fg">
              {formatMinutes((impact.totalBaselineSec as number) / 60)}
            </span>{" "}
            manual
          </div>
        </div>
      )}

      <ul className="space-y-2.5">
        {withBaseline.map((s) => {
          const baselineSec = s.baselineSec as number;
          return (
            <li
              key={s.stage}
              className="grid grid-cols-[72px_minmax(0,1fr)_112px] items-center gap-3"
            >
              <span className="text-xs text-muted">{stageLabel(s.stage)}</span>
              <div className="space-y-1">
                <div
                  className="h-1.5 rounded-full bg-line-strong"
                  style={{ width: `${(baselineSec / maxSec) * 100}%` }}
                />
                <div className="h-1.5">
                  {s.relaySec !== null && (
                    <div
                      className="h-full min-w-[3px] rounded-full bg-accent"
                      style={{ width: `${(s.relaySec / maxSec) * 100}%` }}
                    />
                  )}
                </div>
              </div>
              <span className="text-right font-mono text-[11px] text-subtle">
                {formatMinutes(baselineSec / 60)} →{" "}
                <span className={s.relaySec !== null ? "text-accent" : ""}>
                  {s.relaySec !== null ? formatMinutes(s.relaySec / 60) : "-"}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex gap-4 text-[11px] text-subtle">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-3 rounded-full bg-line-strong" />
          Manual (team estimate)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-3 rounded-full bg-accent" />
          Relay (Bob) (measured)
        </span>
      </div>
    </Dialog>
  );
}
