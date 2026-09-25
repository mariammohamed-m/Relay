import { useState } from 'react';
import { BarChart3Icon, PanelLeftIcon } from 'lucide-react';
import type { CompiledTask, ImpactSummary } from '@/lib/types';
import { taskActivity } from '@/lib/taskActivity';
import { formatTimestamp } from '@/lib/format';
import { TasksSheet } from './TasksSheet';
import { ImpactDialog } from './ImpactDialog';

interface AppBarProps {
  tasks: CompiledTask[];
  activeTaskId: string;
  onSelect: (taskId: string) => void;
  generatedAt: string;
  impact: ImpactSummary;
}

export function AppBar({ tasks, activeTaskId, onSelect, generatedAt, impact }: AppBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [impactOpen, setImpactOpen] = useState(false);
  const active = tasks.find((t) => t.id === activeTaskId);
  const activity = active ? taskActivity(active) : '';
  const failed = activity.endsWith('failed');
  const live = active ? !failed && activity !== 'Complete' && activity !== 'Waiting' : false;

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-canvas/95 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-[1600px] items-center gap-3 px-6">
        <div className="flex items-center gap-2">
          <RelayMark />
          <span className="text-sm font-semibold tracking-tight text-fg">Relay</span>
        </div>
        <span className="h-4 w-px bg-line" aria-hidden />
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors duration-150 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <PanelLeftIcon className="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden />
          {active && (
            <>
              <span className="font-mono text-xs text-muted">{active.id}</span>
              <span className="truncate text-fg">{active.title}</span>
            </>
          )}
        </button>
        <div className="ml-auto flex shrink-0 items-center gap-4">
          <span className="hidden font-mono text-[11px] text-subtle lg:inline">compiled {formatTimestamp(generatedAt)}</span>
          {active && (
            <span className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded border border-line bg-surface px-2 py-1 text-xs text-muted">
              <span
                className={`h-1.5 w-1.5 rounded-full ${failed ? 'bg-bad' : live ? 'bg-accent motion-safe:animate-pulse' : 'bg-ok'}`}
                aria-hidden
              />
              <span className="text-fg">{activity}</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => setImpactOpen(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs text-subtle transition-colors duration-150 hover:bg-surface hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <BarChart3Icon className="h-3.5 w-3.5" aria-hidden />
            Impact
          </button>
        </div>
      </div>

      <TasksSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        tasks={tasks}
        activeTaskId={activeTaskId}
        onSelect={onSelect}
      />
      <ImpactDialog open={impactOpen} onOpenChange={setImpactOpen} impact={impact} />
    </header>
  );
}

function RelayMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <rect x="1" y="1" width="18" height="18" rx="4" className="fill-accent" />
      <rect x="4.5" y="8.5" width="11" height="3" rx="1.5" transform="rotate(-35 10 10)" className="fill-canvas" />
    </svg>
  );
}
