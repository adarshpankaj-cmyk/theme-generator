import type { JSX, SelectHTMLAttributes } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

/**
 * A compact, on-theme native `<select>`. Native (rather than a Base UI popover)
 * keeps it accessible and dependency-free for the small, fixed option lists the
 * blend editor needs; the chevron is a decorative overlay.
 */
function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>): JSX.Element {
  return (
    <div className="relative inline-flex items-center">
      <select
        data-slot="select"
        className={cn(
          'h-8 appearance-none rounded-lg border border-border bg-card/60 py-1 pl-2.5 pr-7 font-mono text-xs text-foreground outline-none transition-shadow hover:ring-2 hover:ring-ring/30 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <HugeiconsIcon
        icon={ArrowDown01Icon}
        className="pointer-events-none absolute right-2 size-3.5 text-muted-foreground"
      />
    </div>
  );
}

export { Select };
