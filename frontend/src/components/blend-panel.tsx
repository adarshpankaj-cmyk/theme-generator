import type { JSX } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';
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
} from '@/lib/blend';
import { findTemplate, templateLabel } from '@/lib/template-registry';
import { cn } from '@/lib/utils';

interface BlendPanelProps {
  readonly templateId: string;
  readonly selectedSelector: string | null;
  readonly overrides: BlendOverrides;
  readonly themeOpacity: number | null;
  readonly onSelectStrip: (selector: string) => void;
  readonly onStripEnabled: (selector: string, enabled: boolean) => void;
  readonly onStripAlpha: (selector: string, alpha: number) => void;
  readonly onStripTint: (selector: string, hex: string) => void;
  readonly onClose: () => void;
}

/** Shorten a selector for display (drop the leading dot / attribute noise). */
function selectorLabel(selector: string): string {
  return selector.replace(/^\./, '').replace(/^#/, '#');
}

/**
 * Contextual blend editor for one template (SPEC §5). Lists the template's
 * strips (the click-to-pick fallback) and, when a strip is selected, exposes its
 * enabled / alpha / tint controls.
 */
export function BlendPanel({
  templateId,
  selectedSelector,
  overrides,
  themeOpacity,
  onSelectStrip,
  onStripEnabled,
  onStripAlpha,
  onStripTint,
  onClose,
}: BlendPanelProps): JSX.Element {
  const definition = findTemplate(templateId);
  const selectors = definition?.selectors ?? [];
  const fallbackAlpha = effectiveOpacity(overrides, templateId, themeOpacity);

  return (
    <aside className="flex w-full flex-col gap-4 rounded-xl border bg-card p-4 lg:w-80">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-card-foreground">Blend</h2>
          <p className="text-xs text-muted-foreground">
            {definition ? templateLabel(definition) : templateId}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close blend panel"
          className="text-muted-foreground hover:text-foreground"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Strips</Label>
        <div className="flex flex-col gap-1">
          {selectors.map((selector) => {
            const enabled = isStripEnabled(overrides, templateId, selector);
            const isActive = selector === selectedSelector;
            return (
              <button
                key={selector}
                type="button"
                onClick={() => onSelectStrip(selector)}
                className={cn(
                  'flex items-center justify-between rounded-md px-2 py-1.5 text-left font-mono text-xs transition-colors',
                  isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
                  !enabled && 'opacity-50',
                )}
              >
                <span className="truncate">{selectorLabel(selector)}</span>
                {!enabled ? <span className="text-[10px] uppercase">off</span> : null}
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
          fallbackAlpha={fallbackAlpha}
          onStripEnabled={onStripEnabled}
          onStripAlpha={onStripAlpha}
          onStripTint={onStripTint}
        />
      ) : (
        <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          Click a strip above — or directly in the preview — to adjust it.
        </p>
      )}
    </aside>
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
    <div className="flex flex-col gap-4 border-t pt-4">
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
