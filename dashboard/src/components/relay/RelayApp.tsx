import { useEffect, useState } from 'react';
import { FileWarningIcon, FileX2Icon, InboxIcon, RefreshCwIcon, WifiOffIcon } from 'lucide-react';
import { useRelayData } from '@/hooks/useRelayData';
import { defaultActiveTaskId } from '@/lib/selectTask';
import { AppBar } from './AppBar';
import { JourneyRail } from './JourneyRail';
import { CriteriaCoverage } from './CriteriaCoverage';
import { KnowledgeFeed } from './KnowledgeFeed';
import { BatonPanel } from './BatonPanel';
import { ParallelLanes } from './ParallelLanes';
import { EmptyState } from './EmptyState';

export function RelayApp() {
  const { data: result } = useRelayData();
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const tasks = result?.ok ? result.data.tasks : [];

  useEffect(() => {
    if (!result?.ok) return;
    const stillExists = activeTaskId && tasks.some((t) => t.id === activeTaskId);
    if (!stillExists) setActiveTaskId(defaultActiveTaskId(tasks));
  }, [result?.ok, tasks]);

  if (!result) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas">
        <span className="font-mono text-xs text-subtle">loading…</span>
      </div>
    );
  }

  if (!result.ok) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas px-6">
        <FailureState failure={result.failure} />
      </div>
    );
  }

  const { data } = result;

  if (data.tasks.length === 0) {
    return (
      <div className="min-h-screen bg-canvas text-fg">
        <main className="mx-auto max-w-[1600px] px-6 py-16">
          <EmptyState
            icon={InboxIcon}
            title="No tasks yet"
            description="Once `relay scaffold` creates a task and `relay compile` runs, it will show up here."
          />
        </main>
      </div>
    );
  }

  const activeTask = data.tasks.find((t) => t.id === activeTaskId) ?? data.tasks[0];

  return (
    <div className="min-h-screen w-full bg-canvas text-fg">
      <AppBar
        tasks={data.tasks}
        activeTaskId={activeTask.id}
        onSelect={setActiveTaskId}
        generatedAt={data.generatedAt}
        impact={data.impact}
      />
      <main className="mx-auto max-w-[1600px] space-y-5 px-6 py-6">
        <JourneyRail task={activeTask} />

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-5">
            <CriteriaCoverage task={activeTask} />
          </div>
          <div className="space-y-5">
            <KnowledgeFeed knowledge={data.knowledge} task={activeTask} />
            <BatonPanel task={activeTask} knowledge={data.knowledge} />
          </div>
        </div>

        <ParallelLanes task={activeTask} />
      </main>
    </div>
  );
}

function FailureState({ failure }: { failure: { kind: string; detail?: string; found?: number } }) {
  switch (failure.kind) {
    case 'missing':
      return (
        <EmptyState
          icon={FileX2Icon}
          title="No data file found"
          description="dashboard/public/relay-data.json doesn't exist yet. Run `relay compile` to generate it."
        />
      );
    case 'unreachable':
      return (
        <EmptyState
          icon={WifiOffIcon}
          title="Can't reach the data file"
          description="The dev server didn't return relay-data.json."
          detail={failure.detail}
        />
      );
    case 'malformed':
      return (
        <EmptyState
          icon={FileWarningIcon}
          title="Data file is malformed"
          description="relay-data.json doesn't parse as valid RelayData. Re-run `relay compile`."
          detail={failure.detail}
        />
      );
    case 'schema-mismatch':
      return (
        <EmptyState
          icon={RefreshCwIcon}
          title="Schema version mismatch"
          description="This dashboard build expects a different schema version than the compiled data has."
          detail={`found schemaVersion ${failure.found}`}
        />
      );
    default:
      return <EmptyState icon={FileWarningIcon} title="Something's off" description="Unrecognized failure." />;
  }
}
