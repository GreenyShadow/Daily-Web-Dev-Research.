import * as React from 'react';
import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';

// Extended beyond stock shadcn/ui with one variant per ticket status, so
// StatusBadge.jsx can render <Badge variant="pending" /> etc. instead of
// resolving colors from STATUS_META at the call site.
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 before:size-1.5 before:rounded-full before:bg-current',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'text-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        pending: 'border-transparent bg-status-pending-bg text-status-pending-fg',
        accepted: 'border-transparent bg-status-accepted-bg text-status-accepted-fg',
        in_progress: 'border-transparent bg-status-progress-bg text-status-progress-fg',
        resolved: 'border-transparent bg-status-resolved-bg text-status-resolved-fg',
        closed: 'border-transparent bg-status-closed-bg text-status-closed-fg',
        denied: 'border-transparent bg-status-denied-bg text-status-denied-fg',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
