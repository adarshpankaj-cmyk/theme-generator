import type { JSX } from 'react';
import { cn } from '@/lib/utils';

interface VariantStripProps {
  /** Thumbnail artwork URLs, one per variant (typically the A4 portraits). */
  readonly variants: readonly string[];
  /** Index of the currently active variant. */
  readonly selected: number;
  readonly onSelect: (index: number) => void;
}

/**
 * The artwork chooser (SPEC §5): a row of candidate thumbnails above the preview
 * grid. Clicking one makes it the active artwork; the whole grid re-renders with
 * it. Rendered only when a theme has more than one variant.
 */
export function VariantStrip({ variants, selected, onSelect }: VariantStripProps): JSX.Element {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-card-foreground">Choose artwork</span>
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
                'group relative h-24 w-20 shrink-0 overflow-hidden rounded-lg border-2 bg-muted transition',
                isSelected
                  ? 'border-primary ring-2 ring-primary/30'
                  : 'border-border hover:border-muted-foreground/40',
              )}
            >
              <img
                src={url}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
              <span className="absolute bottom-0 inset-x-0 bg-background/80 py-0.5 text-center text-[11px] font-medium text-foreground">
                {index + 1}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
