import type { JSX } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Loading03Icon } from '@hugeicons/core-free-icons';
import type { PreviewResponse } from '@/api/types';
import { PreviewCard } from '@/components/preview-card';

interface PreviewGridProps {
  readonly preview?: PreviewResponse;
  readonly isLoading: boolean;
  readonly selectedTemplateId?: string | null;
  readonly onSelectTemplate?: (templateId: string) => void;
}

/**
 * The "see everything at once" grid (F8): every invoice format rendered with the
 * overlay applied. Templates come pre-ordered from the backend registry, so we
 * render them as-is. Landscape (A5) cells are self-sizing via their aspect ratio.
 */
export function PreviewGrid({
  preview,
  isLoading,
  selectedTemplateId = null,
  onSelectTemplate,
}: PreviewGridProps): JSX.Element {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border bg-card px-6 py-16 text-muted-foreground">
        <HugeiconsIcon icon={Loading03Icon} className="size-5 animate-spin" />
        <span className="text-sm">Loading previews…</span>
      </div>
    );
  }

  if (!preview || preview.templates.length === 0) {
    return (
      <div className="rounded-xl border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
        No previews available for this theme.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {preview.templates.map((template) => (
        <PreviewCard
          key={template.template_id}
          preview={template}
          isSelected={template.template_id === selectedTemplateId}
          onSelectTemplate={onSelectTemplate}
        />
      ))}
    </div>
  );
}
