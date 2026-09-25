import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";

interface EmptyStateProps {
  icon: ComponentType<LucideProps>;
  title: string;
  description: string;
  detail?: string;
  children?: ReactNode;
}

/**
 * The one calm, designed empty state every failure mode and every
 * zero-data case routes through - never a crash, never a blank screen.
 * Deliberately quiet: no accent color, no icon glow, nothing that reads
 * as an alarm, since most of these states (no baseline yet, no criteria
 * yet, uncovered work) are expected, not broken.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  detail,
  children,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-full border border-line bg-raised text-subtle">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-medium text-fg">{title}</p>
        <p className="text-sm text-muted">{description}</p>
      </div>
      {detail && (
        <p className="max-w-sm break-words rounded-md border border-line bg-canvas px-3 py-2 font-mono text-[11px] text-subtle">
          {detail}
        </p>
      )}
      {children}
    </div>
  );
}
