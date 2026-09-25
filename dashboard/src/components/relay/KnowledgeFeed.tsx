import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRightIcon, RotateCcwIcon, SparklesIcon } from 'lucide-react';
import type { KnowledgeEntry, RelayData, Task } from '@/lib/types';
import { formatMinutes } from '@/lib/format';
import { Panel } from './Panel';
import { EmptyState } from './EmptyState';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface KnowledgeFeedProps {
  knowledge: RelayData['knowledge'];
  task: Task;
}

// The flywheel made literal: newest entries first, and anything the active
// task pulled in via `knowledgeHarvested` gets a visible accent marker so a
// gotcha appearing here mid-demo reads as "just arrived," not just another
// list row.
export function KnowledgeFeed({ knowledge, task }: KnowledgeFeedProps) {
  const sorted = [...knowledge].sort((a, b) => new Date(b.discoveredAt).getTime() - new Date(a.discoveredAt).getTime());

  return (
    <Panel title="Knowledge feed" meta="lessons from debugging">
      {sorted.length === 0 ? (
        <EmptyState
          icon={SparklesIcon}
          title="No knowledge harvested yet"
          description="Gotchas written during debug stages will appear here, newest first."
        />
      ) : (
        <ol className="relative space-y-4 border-l border-line pl-5">
          {sorted.map((entry) => (
            <KnowledgeRow key={entry.id} entry={entry} harvested={task.knowledgeHarvested.includes(entry.id)} />
          ))}
        </ol>
      )}
    </Panel>
  );
}

function KnowledgeRow({ entry, harvested }: { entry: KnowledgeEntry; harvested: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <li className="relative">
      <span
        className={cn(
          'absolute -left-[25px] top-1.5 h-2 w-2 rounded-full ring-4 ring-surface',
          harvested ? 'bg-accent motion-safe:animate-pulse' : 'bg-line-strong',
        )}
        aria-hidden
      />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 text-left transition-colors duration-150 focus-visible:outline-none"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h4 className="text-sm font-medium text-fg">{entry.title}</h4>
            {harvested && (
              <Badge variant="accent">
                <RotateCcwIcon className="h-3 w-3" aria-hidden />
                harvested this task
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-subtle">
            <span className={harvested ? 'text-accent' : ''}>{entry.id}</span>
            <span>discovered in {entry.discoveredIn}</span>
            <span>{formatMinutes(entry.costMinutes)} lost</span>
          </div>
        </div>
        <ChevronRightIcon
          className={cn('mt-0.5 h-4 w-4 shrink-0 text-subtle transition-transform duration-200', open && 'rotate-90')}
          aria-hidden
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <dl className="mt-3 space-y-2.5 text-sm">
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-subtle">Symptom</dt>
                <dd className="mt-0.5 text-muted">{entry.symptom}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-subtle">Root cause</dt>
                <dd className="mt-0.5 text-muted">{entry.rootCause}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-subtle">Fix</dt>
                <dd className="mt-0.5 text-muted">{entry.fix}</dd>
              </div>
            </dl>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
