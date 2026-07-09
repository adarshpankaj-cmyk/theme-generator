import type { JSX } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Tick02Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

interface VariantStripProps {
  /** Thumbnail artwork URLs, one per variant (typically the A4 portraits). */
  readonly variants: readonly string[];
  /** Index of the currently active variant. */
  readonly selected: number;
  readonly onSelect: (index: number) => void;
}

/**
 * The artwork chooser (SPEC §5): a row of candidate thumbnails above the canvas
 * panels. Clicking one makes it the active artwork; every invoice re-renders
 * with it. Rendered only when a theme has more than one variant.
 */
export function VariantStrip({ variants, selected, onSelect }: VariantStripProps): JSX.Element {
  return (
    <div className="flex animate-in flex-col gap-4 rounded-2xl border border-border/80 bg-card/70 px-5 py-4 backdrop-blur duration-500 fade-in slide-in-from-bottom-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-display text-sm font-semibold text-card-foreground">
          Choose artwork
        </span>
        <span className="text-xs text-muted-foreground">
          {variants.length} options from your prompt — click one to preview it on every invoice.
        </span>
      </div>

      <div className="flex flex-wrap gap-3">
        {variants.map((url, index) => {
          const isSelected = index === selected;
          return (
            <button
              key={url}
              type="button"
              aria-pressed={isSelected}
              aria-label={`Artwork variant ${index + 1}`}
              onClick={() => onSelect(index)}
              className={cn(
                'group relative h-28 w-[5.5rem] shrink-0 overflow-hidden rounded-xl bg-muted transition-all duration-200',
                isSelected
                  ? 'shadow-lg shadow-brand/30 ring-2 ring-brand-bright'
                  : 'ring-1 ring-border hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/30 hover:ring-muted-foreground/50',
              )}
            >
              <img
                src={url}
                alt=""
                loading="lazy"
                className={cn(
                  'h-full w-full object-cover transition-transform duration-300',
                  !isSelected && 'group-hover:scale-105',
                )}
              />
              {isSelected ? (
                <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-brand text-white shadow-md">
                  <HugeiconsIcon icon={Tick02Icon} className="size-3.5" />
                </span>
              ) : (
                <span className="absolute bottom-1.5 left-1.5 flex size-5 items-center justify-center rounded-full bg-black/60 text-[11px] font-medium text-white backdrop-blur-sm">
                  {index + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
