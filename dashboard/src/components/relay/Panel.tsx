import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PanelProps {
  title: string;
  meta?: string;
  children: ReactNode;
  className?: string;
}

export function Panel({ title, meta, children, className }: PanelProps) {
  return (
    <section className={cn('rounded-lg border border-line bg-surface p-5', className)}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-fg">{title}</h2>
        {meta && <span className="text-xs text-subtle">{meta}</span>}
      </div>
      {children}
    </section>
  );
}
