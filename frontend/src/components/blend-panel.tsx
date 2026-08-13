import type { JSX } from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ColorField } from '@/components/color-field';
import type { BlendOverrides } from '@/api/types';
import {
  effectiveOpacity,
  effectiveStripAlpha,
  isStripEnabled,
  stripSettings,
  templateOverride,
} from '@/lib/blend';
import { findTemplate } from '@/lib/template-registry';
import { cn } from '@/lib/utils';

interface BlendPanelProps {
  readonly templateId: string;
  readonly selectedSelector: string | null;
  readonly overrides: BlendOverrides;
  readonly themeOpacity: number | null;
  readonly onSelectStrip: (selector: string) => void;
  readonly onArtworkOpacity: (value: number) => void;
  readonly onTemplateTint: (hex: string) => void;
  readonly onStripEnabled: (selector: string, enabled: boolean) => void;
  readonly onStripAlpha: (selector: string, alpha: number) => void;
  readonly onStripTint: (selector: string, hex: string) => void;
}

/** Shorten a selector for display (drop the leading dot / attribute noise). */
function selectorLabel(selector: string): string {
  return selector.replace(/^\./, '').replace(/^#/, '#');
}

/** Read the single-decimal percentage for display. */
function toPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * The always-visible blend rail for one carousel panel (SPEC §5), bound to the
 * template currently shown. Template-level artwork controls on top, then the
 * template's strips (the click-to-pick fallback) and, when a strip is selected,
 * its enabled / alpha / tint controls.
 */
export function BlendPanel({
  templateId,
  selectedSelector,
  overrides,
  themeOpacity,
  onSelectStrip,
  onArtworkOpacity,
  onTemplateTint,
  onStripEnabled,
  onStripAlpha,
  onStripTint,
}: BlendPanelProps): JSX.Element {
  const definition = findTemplate(templateId);
  const selectors = definition?.selectors ?? [];
  const opacity = effectiveOpacity(overrides, templateId, themeOpacity);
  const tint = templateOverride(overrides, templateId).tint_hex ?? '';

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
          Artwork
        </h4>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-muted-foreground">
              Opacity
              {definition ? (
                <span className="text-xs text-muted-foreground/70">
                  all {definition.canvas.toUpperCase()}
                </span>
              ) : null}
            </Label>
            <span className="font-mono text-xs text-muted-foreground">{toPercent(opacity)}</span>
          </div>
          <Slider
            value={[opacity]}
            min={0}
            max={1}
            step={0.01}
            aria-label="Artwork opacity"
            onValueChange={(value) => onArtworkOpacity(Array.isArray(value) ? value[0] : value)}
          />
        </div>
        <ColorField label="Tint" value={tint} onChange={onTemplateTint} />
      </div>

      <div className="flex flex-col gap-2 border-t border-border/70 pt-4">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
          Strips
        </h4>
        <div className="flex flex-col gap-0.5">
          {selectors.map((selector) => {
            const enabled = isStripEnabled(overrides, templateId, selector);
            const isActive = selector === selectedSelector;
            return (
              <button
                key={selector}
                type="button"
                onClick={() => onSelectStrip(selector)}
                className={cn(
                  'flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left font-mono text-xs transition-colors duration-150',
                  isActive
                    ? 'bg-brand/15 text-brand-bright ring-1 ring-brand/30'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  !enabled && 'opacity-45',
                )}
              >
                <span className="truncate">{selectorLabel(selector)}</span>
                {!enabled ? (
                  <span className="rounded bg-muted px-1 py-px text-[9px] uppercase tracking-wider">
                    off
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {selectedSelector ? (
        <StripControls
          templateId={templateId}
          selector={selectedSelector}
          overrides={overrides}
          fallbackAlpha={opacity}
          onStripEnabled={onStripEnabled}
          onStripAlpha={onStripAlpha}
          onStripTint={onStripTint}
        />
      ) : (
        <p className="rounded-lg border border-dashed border-border/80 bg-muted/30 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          Click a strip above — or directly in the preview — to adjust it.
        </p>
      )}
    </div>
  );
}

interface StripControlsProps {
  readonly templateId: string;
  readonly selector: string;
  readonly overrides: BlendOverrides;
  readonly fallbackAlpha: number;
  readonly onStripEnabled: (selector: string, enabled: boolean) => void;
  readonly onStripAlpha: (selector: string, alpha: number) => void;
  readonly onStripTint: (selector: string, hex: string) => void;
}

function StripControls({
  templateId,
  selector,
  overrides,
  fallbackAlpha,
  onStripEnabled,
  onStripAlpha,
  onStripTint,
}: StripControlsProps): JSX.Element {
  const enabled = isStripEnabled(overrides, templateId, selector);
  const alpha = effectiveStripAlpha(overrides, templateId, selector, fallbackAlpha);
  const tint = stripSettings(overrides, templateId, selector).tint_hex ?? '';

  return (
    <div className="flex animate-in flex-col gap-4 border-t border-border/70 pt-4 duration-300 fade-in">
      <div className="flex items-center justify-between">
        <Label className="text-sm text-muted-foreground">Enabled</Label>
        <Switch
          checked={enabled}
          onCheckedChange={(checked) => onStripEnabled(selector, checked)}
          aria-label="Strip enabled"
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm text-muted-foreground">Alpha</Label>
          <span className="font-mono text-xs text-muted-foreground">{alpha.toFixed(2)}</span>
        </div>
        <Slider
          value={[alpha]}
          min={0}
          max={1}
          step={0.01}
          disabled={!enabled}
          aria-label="Strip alpha"
          onValueChange={(value) => onStripAlpha(selector, Array.isArray(value) ? value[0] : value)}
        />
      </div>

      <ColorField
        label="Tint"
        value={tint}
        disabled={!enabled}
        onChange={(hex) => onStripTint(selector, hex)}
      />
    </div>
  );
}
