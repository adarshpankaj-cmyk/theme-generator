import { useMemo, type JSX } from 'react';
import type { TemplatePreview } from '@/api/types';
import { useMeasuredWidth } from '@/hooks/use-measured-width';
import { CANVAS_DIMENSIONS } from '@/lib/canvas';
import { buildPreviewSrcDoc } from '@/lib/preview-srcdoc';
import { findTemplate, templateLabel } from '@/lib/template-registry';

interface PreviewCardProps {
  readonly preview: TemplatePreview;
}

/**
 * One template preview: a style-isolated iframe rendering the base invoice +
 * overlay CSS, scaled down to fit the card while preserving the canvas aspect
 * ratio (SPEC §4). The container uses `aspect-ratio` so it reserves correct
 * height before the iframe is measured — no layout flash. Strips inside the
 * iframe are clickable (they postMessage their selector to the parent, §5).
 */
export function PreviewCard({ preview }: PreviewCardProps): JSX.Element {
  const dimensions = CANVAS_DIMENSIONS[preview.canvas];
  const definition = findTemplate(preview.template_id);
  const label = definition ? templateLabel(definition) : preview.template_id;

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
    <div className="overflow-hidden rounded-lg bg-white shadow-2xl shadow-black/50 ring-1 ring-white/10">
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
