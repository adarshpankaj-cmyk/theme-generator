import type { JSX } from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ColorField } from '@/components/color-field';
import type { BlendOverrides } from '@/api/types';
import { effectiveOpacity, templateOverride } from '@/lib/blend';
import { findTemplate, templateLabel } from '@/lib/template-registry';

interface ToolbarProps {
  /** The template the template-level controls act on, or null when none picked. */
  readonly activeTemplateId: string | null;
  readonly overrides: BlendOverrides;
  readonly themeOpacity: number | null;
  readonly onArtworkOpacity: (templateId: string, value: number) => void;
  readonly onTemplateTint: (templateId: string, hex: string) => void;
}

/** Read the single-decimal percentage for display. */
function toPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Template-level blend controls (SPEC §5): artwork opacity + template tint for
 * the active template. Disabled with a hint until a template is picked (click a
 * card header or a strip inside a preview).
 */
export function Toolbar({
  activeTemplateId,
  overrides,
  themeOpacity,
  onArtworkOpacity,
  onTemplateTint,
}: ToolbarProps): JSX.Element {
  const definition = activeTemplateId ? findTemplate(activeTemplateId) : undefined;
  const opacity = activeTemplateId ? effectiveOpacity(overrides, activeTemplateId, themeOpacity) : 0;
  const tint = activeTemplateId ? (templateOverride(overrides, activeTemplateId).tint_hex ?? '') : '';
  const disabled = activeTemplateId === null;

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-medium text-card-foreground">Artwork</span>
        <span className="text-xs text-muted-foreground">
          {definition ? `Editing ${templateLabel(definition)}` : 'Select a preview to edit its artwork'}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <Label className="whitespace-nowrap text-sm text-muted-foreground">Opacity</Label>
        {/* Fixed-width wrapper: the Slider hardcodes `w-full`, so it fills this
            box instead of collapsing to min-content in the flex row. */}
        <div className="w-40 shrink-0">
          <Slider
            value={[opacity]}
            min={0}
            max={1}
            step={0.01}
            disabled={disabled}
            aria-label="Artwork opacity"
            onValueChange={(value) => {
              if (activeTemplateId) {
                onArtworkOpacity(activeTemplateId, Array.isArray(value) ? value[0] : value);
              }
            }}
          />
        </div>
        <span className="w-10 text-right font-mono text-xs text-muted-foreground">
          {disabled ? '—' : toPercent(opacity)}
        </span>
      </div>

      <div className="min-w-56">
        <ColorField
          label="Tint"
          value={tint}
          disabled={disabled}
          onChange={(hex) => activeTemplateId && onTemplateTint(activeTemplateId, hex)}
        />
      </div>
    </div>
  );
}
