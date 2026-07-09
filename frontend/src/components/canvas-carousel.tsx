import type { JSX, KeyboardEvent } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import type { BlendOverrides, Canvas, TemplatePreview } from '@/api/types';
import { PreviewCard } from '@/components/preview-card';
import { BlendPanel } from '@/components/blend-panel';
import { findTemplate, templateLabel } from '@/lib/template-registry';
import { cn } from '@/lib/utils';

interface CanvasCarouselProps {
  /** Panel heading, e.g. "A4 invoices". */
  readonly title: string;
  readonly canvas: Canvas;
  /** Preview templates for this canvas, in registry order. */
  readonly templates: readonly TemplatePreview[];
  readonly activeIndex: number;
  readonly selectedSelector: string | null;
  readonly overrides: BlendOverrides;
  readonly themeOpacity: number | null;
  readonly onNavigate: (canvas: Canvas, index: number) => void;
  readonly onSelectStrip: (canvas: Canvas, selector: string) => void;
  readonly onArtworkOpacity: (templateId: string, value: number) => void;
  readonly onTemplateTint: (templateId: string, hex: string) => void;
  readonly onStripEnabled: (templateId: string, selector: string, enabled: boolean) => void;
  readonly onStripAlpha: (templateId: string, selector: string, alpha: number) => void;
  readonly onStripTint: (templateId: string, selector: string, hex: string) => void;
}

/** Preview column width caps so an A4 page doesn't fill the whole viewport. */
const PREVIEW_MAX_WIDTH: Record<Canvas, string> = {
  a4: 'max-w-[560px]',
  a5: 'max-w-[760px]',
};

/**
 * One "big panel" per canvas: a single large preview with ‹ › arrows cycling
 * through that canvas's templates, plus the always-visible blend rail on the
 * right, bound to whichever template is currently shown.
 */
export function CanvasCarousel({
  title,
  canvas,
  templates,
  activeIndex,
  selectedSelector,
  overrides,
  themeOpacity,
  onNavigate,
  onSelectStrip,
  onArtworkOpacity,
  onTemplateTint,
  onStripEnabled,
  onStripAlpha,
  onStripTint,
}: CanvasCarouselProps): JSX.Element | null {
  if (templates.length === 0) {
    return null;
  }

  const index = Math.min(activeIndex, templates.length - 1);
  const active = templates[index];
  const definition = findTemplate(active.template_id);
  const label = definition ? templateLabel(definition) : active.template_id;

  const step = (direction: -1 | 1): void => {
    onNavigate(canvas, (index + direction + templates.length) % templates.length);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      step(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      step(1);
    }
  };

  return (
    <section
      aria-label={title}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="flex animate-in flex-col gap-4 rounded-2xl border border-border/80 bg-card/70 p-5 backdrop-blur duration-500 fade-in slide-in-from-bottom-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-base font-semibold tracking-tight text-card-foreground">
          {title}
        </h3>
        <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
          <span className="rounded-full border border-border/80 bg-muted/50 px-2.5 py-0.5 font-mono">
            {label}
          </span>
          <span className="tabular-nums">
            {index + 1} / {templates.length}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <ArrowButton direction="previous" onClick={() => step(-1)} />

        <div className="flex min-w-0 flex-1 items-center justify-center rounded-xl bg-background/60 p-6 shadow-inner shadow-black/30 ring-1 ring-black/20">
          <div
            key={active.template_id}
            className={cn(
              'w-full animate-in duration-300 fade-in zoom-in-[0.98]',
              PREVIEW_MAX_WIDTH[canvas],
            )}
          >
            <PreviewCard preview={active} />
          </div>
        </div>

        <ArrowButton direction="next" onClick={() => step(1)} />

        <div className="w-full shrink-0 lg:w-72 lg:border-l lg:border-border/70 lg:pl-5">
          <BlendPanel
            templateId={active.template_id}
            selectedSelector={selectedSelector}
            overrides={overrides}
            themeOpacity={themeOpacity}
            onSelectStrip={(selector) => onSelectStrip(canvas, selector)}
            onArtworkOpacity={(value) => onArtworkOpacity(active.template_id, value)}
            onTemplateTint={(hex) => onTemplateTint(active.template_id, hex)}
            onStripEnabled={(selector, enabled) => onStripEnabled(active.template_id, selector, enabled)}
            onStripAlpha={(selector, alpha) => onStripAlpha(active.template_id, selector, alpha)}
            onStripTint={(selector, hex) => onStripTint(active.template_id, selector, hex)}
          />
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5" role="tablist" aria-label={`${title} templates`}>
        {templates.map((template, dotIndex) => {
          const dotDefinition = findTemplate(template.template_id);
          const dotLabel = dotDefinition ? templateLabel(dotDefinition) : template.template_id;
          return (
            <button
              key={template.template_id}
              type="button"
              role="tab"
              aria-selected={dotIndex === index}
              aria-label={`Show ${dotLabel}`}
              onClick={() => onNavigate(canvas, dotIndex)}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                dotIndex === index
                  ? 'w-6 bg-brand-bright shadow-sm shadow-brand/50'
                  : 'w-2 bg-muted hover:bg-muted-foreground/50',
              )}
            />
          );
        })}
      </div>
    </section>
  );
}

interface ArrowButtonProps {
  readonly direction: 'previous' | 'next';
  readonly onClick: () => void;
}

function ArrowButton({ direction, onClick }: ArrowButtonProps): JSX.Element {
  const isPrevious = direction === 'previous';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isPrevious ? 'Previous theme' : 'Next theme'}
      className="flex size-10 shrink-0 items-center justify-center self-center rounded-full border border-border bg-card text-muted-foreground shadow-md shadow-black/25 transition-all duration-200 hover:scale-105 hover:border-brand/50 hover:text-brand-bright active:scale-95"
    >
      <HugeiconsIcon icon={isPrevious ? ArrowLeft01Icon : ArrowRight01Icon} className="size-5" />
    </button>
  );
}
