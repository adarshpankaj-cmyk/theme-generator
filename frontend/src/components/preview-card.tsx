import { useMemo, type JSX } from 'react';
import type { TemplatePreview } from '@/api/types';
import { useMeasuredWidth } from '@/hooks/use-measured-width';
import { CANVAS_DIMENSIONS } from '@/lib/canvas';
import { buildPreviewSrcDoc } from '@/lib/preview-srcdoc';
import { findTemplate, templateLabel } from '@/lib/template-registry';
import { cn } from '@/lib/utils';

interface PreviewCardProps {
  readonly preview: TemplatePreview;
  /** Highlights the card when it owns the active blend selection. */
  readonly isSelected?: boolean;
  /** Select this template (header click) without picking a specific strip. */
  readonly onSelectTemplate?: (templateId: string) => void;
}

/**
 * One template preview: a style-isolated iframe rendering the base invoice +
 * overlay CSS, scaled down to fit the card while preserving the canvas aspect
 * ratio (SPEC §4). The container uses `aspect-ratio` so it reserves correct
 * height before the iframe is measured — no layout flash. Strips inside the
 * iframe are clickable (they postMessage their selector to the parent, §5).
 */
export function PreviewCard({
  preview,
  isSelected = false,
  onSelectTemplate,
}: PreviewCardProps): JSX.Element {
  const dimensions = CANVAS_DIMENSIONS[preview.canvas];
  const definition = findTemplate(preview.template_id);
  const label = definition ? templateLabel(definition) : preview.template_id;
  const isLandscape = preview.canvas === 'a5';

  const srcDoc = useMemo(
    () => buildPreviewSrcDoc(preview, definition?.selectors),
    [
      preview.template_id,
      preview.css,
      preview.base_invoice_html,
      preview.image_url,
      definition?.selectors,
    ],
  );

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-colors',
        isSelected ? 'border-ring ring-2 ring-ring/40' : 'border-border',
      )}
    >
      <button
        type="button"
        onClick={() => onSelectTemplate?.(preview.template_id)}
        className="flex items-center justify-between border-b px-3 py-2 text-left hover:bg-muted/50"
      >
        <span className="text-sm font-medium text-card-foreground">{label}</span>
        <span
          className={cn(
            'rounded-md px-1.5 py-0.5 text-xs font-medium',
            isLandscape ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
          )}
        >
          {preview.canvas.toUpperCase()}
        </span>
      </button>

      <PreviewFrame
        title={label}
        srcDoc={srcDoc}
        canvasWidth={dimensions.width}
        canvasHeight={dimensions.height}
      />
    </div>
  );
}

interface PreviewFrameProps {
  readonly title: string;
  readonly srcDoc: string;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
}

/**
 * The measured, scaled iframe. Rendered at native canvas px then transformed to
 * fill the card width; the wrapper's `aspect-ratio` keeps its height correct.
 */
function PreviewFrame({ title, srcDoc, canvasWidth, canvasHeight }: PreviewFrameProps): JSX.Element {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const scale = width > 0 ? width / canvasWidth : 0;

  return (
    <div
      ref={ref}
      className="relative w-full overflow-hidden bg-white"
      style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}` }}
    >
      {scale > 0 ? (
        <iframe
          title={title}
          srcDoc={srcDoc}
          width={canvasWidth}
          height={canvasHeight}
          scrolling="no"
          sandbox="allow-scripts allow-same-origin"
          className="absolute left-0 top-0 border-0"
          style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
        />
      ) : null}
    </div>
  );
}
