import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Mirrors the mockup's badge idiom: font-mono, hairline border, surface fill.
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[11px]',
  {
    variants: {
      variant: {
        default: 'border-line bg-surface text-muted',
        accent: 'border-accent/30 bg-accent/10 text-accent',
        ok: 'border-ok/30 bg-ok/10 text-ok',
        warn: 'border-warn/30 bg-warn/10 text-warn',
        subtle: 'border-line-strong bg-transparent text-subtle',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
