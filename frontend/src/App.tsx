import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { AiMagicIcon, Loading03Icon, PaintBoardIcon } from '@hugeicons/core-free-icons';
import { PromptBar } from '@/components/prompt-bar';
import { CanvasCarousel } from '@/components/canvas-carousel';
import { StatusBanner } from '@/components/status-banner';
import { DownloadButton } from '@/components/download-button';
import { VariantStrip } from '@/components/variant-strip';
import {
  useBlend,
  useGenerateTheme,
  useRegenerateTheme,
  useSelectVariant,
  useTheme,
  useThemePreview,
} from '@/hooks/use-themes';
import { withStripPatch, withTemplatePatch, withTemplateTintCleared } from '@/lib/blend';
import { findTemplate } from '@/lib/template-registry';
import type {
  BlendInput,
  BlendMode,
  BlendOverrides,
  Canvas,
  CreateThemeInput,
  PreviewResponse,
  TemplateOverride,
  TemplatePreview,
} from '@/api/types';

/** Debounce window for blend PATCHes while dragging sliders (SPEC §5). */
const BLEND_DEBOUNCE_MS = 250;

/**
 * Build the `PATCH /blend` body for one template. `tint_hex ?? null` makes a
 * cleared tint an explicit reset (not an omitted, and therefore ignored, field).
 */
function toBlendInput(templateId: string, override: TemplateOverride): BlendInput {
  return {
    template_id: templateId,
    artwork_opacity: override.artwork_opacity,
    tint_hex: override.tint_hex ?? null,
    blend_mode: override.blend_mode,
    strips: override.strips,
  };
}

/** Panel headings, keyed by canvas. */
const CANVAS_TITLES: Record<Canvas, string> = {
  a4: 'A4 invoices',
  a5: 'A5 invoices',
};

/**
 * Optional deep-link: `?theme=<id>` opens straight into an existing theme,
 * handy for sharing/testing a specific theme without re-generating. Invalid or
 * absent values fall through to the normal empty (generate) state.
 */
function readInitialThemeId(): number | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = new URLSearchParams(window.location.search).get('theme');
  const id = raw ? Number(raw) : Number.NaN;
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Root of the single-screen app (SPEC §3). Owns the current theme id, the
 * per-canvas carousel position and strip selection, and the local
 * blend-overrides working copy, and wires the whole generate → preview → blend
 * loop across the two canvas panels.
 */
export function App(): JSX.Element {
  const [currentThemeId, setCurrentThemeId] = useState<number | null>(readInitialThemeId);
  const [activeIndex, setActiveIndex] = useState<Record<Canvas, number>>({ a4: 0, a5: 0 });
  const [selectedStrips, setSelectedStrips] = useState<Record<Canvas, string | null>>({
    a4: null,
    a5: null,
  });
  const [overrides, setOverrides] = useState<BlendOverrides>({});
  const [cssOverrides, setCssOverrides] = useState<Record<string, string>>({});
  const [selectedVariant, setSelectedVariant] = useState<number>(0);

  const generate = useGenerateTheme();
  const themeQuery = useTheme(currentThemeId);
  const theme = themeQuery.data;
  const regenerate = useRegenerateTheme(currentThemeId ?? 0);
  const blend = useBlend(currentThemeId ?? 0);
  const selectVariant = useSelectVariant(currentThemeId ?? 0);

  const isReady = theme?.status === 'ready';
  const previewQuery = useThemePreview(currentThemeId, isReady);

  // Per-template debounce timers so edits to different templates don't cancel each other.
  const blendTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  useEffect(() => {
    const timers = blendTimers.current;
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, []);

  // Seed the working copy from the server once per theme, when it first becomes
  // ready. Keyed by id so a later theme refetch can't clobber in-progress edits
  // (we don't refetch the theme after a blend, so its overrides would be stale).
  const seededThemeId = useRef<number | null>(null);
  useEffect(() => {
    if (isReady && theme && seededThemeId.current !== theme.id) {
      seededThemeId.current = theme.id;
      setOverrides(theme.blend_overrides ?? {});
    }
  }, [isReady, theme]);

  // Reset transient carousel and blend state when switching themes.
  useEffect(() => {
    setActiveIndex({ a4: 0, a5: 0 });
    setSelectedStrips({ a4: null, a5: null });
    setCssOverrides({});
    setSelectedVariant(0);
  }, [currentThemeId]);

  // Strip-click messages from inside the preview iframes (SPEC §5). Only the
  // visible template of a panel can be clicked, so the selection lands on the
  // clicked template's canvas.
  useEffect(() => {
    const handler = (event: MessageEvent): void => {
      const data: unknown = event.data;
      if (
        data &&
        typeof data === 'object' &&
        (data as { type?: unknown }).type === 'strip-click'
      ) {
        const { templateId, selector } = data as { templateId?: unknown; selector?: unknown };
        if (typeof templateId === 'string' && typeof selector === 'string') {
          const canvas = findTemplate(templateId)?.canvas;
          if (canvas) {
            setSelectedStrips((prev) => ({ ...prev, [canvas]: selector }));
          }
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const scheduleBlend = useCallback(
    (templateId: string, override: TemplateOverride): void => {
      const timers = blendTimers.current;
      const existing = timers.get(templateId);
      if (existing) {
        clearTimeout(existing);
      }
      timers.set(
        templateId,
        setTimeout(() => {
          blend.mutate(toBlendInput(templateId, override), {
            onSuccess: (result) =>
              setCssOverrides((prev) => ({ ...prev, [result.template_id]: result.css })),
          });
        }, BLEND_DEBOUNCE_MS),
      );
    },
    [blend],
  );

  const commit = useCallback(
    (templateId: string, next: BlendOverrides): void => {
      setOverrides(next);
      scheduleBlend(templateId, next[templateId] ?? {});
    },
    [scheduleBlend],
  );

  const handleGenerate = (input: CreateThemeInput): void => {
    generate.mutate(input, { onSuccess: (created) => setCurrentThemeId(created.id) });
  };

  const handleNavigate = useCallback((canvas: Canvas, index: number): void => {
    setActiveIndex((prev) => ({ ...prev, [canvas]: index }));
    setSelectedStrips((prev) => ({ ...prev, [canvas]: null }));
  }, []);

  const handleSelectStrip = useCallback((canvas: Canvas, selector: string): void => {
    setSelectedStrips((prev) => ({ ...prev, [canvas]: selector }));
  }, []);

  const handleArtworkOpacity = useCallback(
    (templateId: string, value: number): void =>
      commit(templateId, withTemplatePatch(overrides, templateId, { artwork_opacity: value })),
    [commit, overrides],
  );

  const handleTemplateTint = useCallback(
    (templateId: string, hex: string): void =>
      commit(templateId, withTemplatePatch(overrides, templateId, { tint_hex: hex })),
    [commit, overrides],
  );

  const handleTemplateTintClear = useCallback(
    (templateId: string): void => commit(templateId, withTemplateTintCleared(overrides, templateId)),
    [commit, overrides],
  );

  const handleBlendMode = useCallback(
    (templateId: string, mode: BlendMode): void =>
      commit(templateId, withTemplatePatch(overrides, templateId, { blend_mode: mode })),
    [commit, overrides],
  );

  const handleStripEnabled = useCallback(
    (templateId: string, selector: string, enabled: boolean): void =>
      commit(templateId, withStripPatch(overrides, templateId, selector, { enabled })),
    [commit, overrides],
  );

  const handleStripAlpha = useCallback(
    (templateId: string, selector: string, alpha: number): void =>
      commit(templateId, withStripPatch(overrides, templateId, selector, { alpha })),
    [commit, overrides],
  );

  const handleStripTint = useCallback(
    (templateId: string, selector: string, hex: string): void =>
      commit(templateId, withStripPatch(overrides, templateId, selector, { tint_hex: hex })),
    [commit, overrides],
  );

  // Merge server previews with (a) the selected artwork variant's image — swapped
  // client-side for an instant compare — and (b) any locally-patched CSS from
  // debounced blends / variant selection.
  const effectivePreview: PreviewResponse | undefined = useMemo(() => {
    const data = previewQuery.data;
    if (!data) {
      return data;
    }
    return {
      templates: data.templates.map((template) => {
        const variantUrl = template.image_urls[selectedVariant];
        const css = cssOverrides[template.template_id];
        if (variantUrl === undefined && css === undefined) {
          return template;
        }
        return {
          ...template,
          ...(css === undefined ? {} : { css }),
          ...(variantUrl === undefined ? {} : { image_url: variantUrl }),
        };
      }),
    };
  }, [previewQuery.data, cssOverrides, selectedVariant]);

  // Pick an artwork variant: swap the image instantly, then persist the choice
  // and apply the recomputed per-template CSS (new tint) via the override path.
  // The variant recompute reads *persisted* overrides, so we first flush any
  // debounced blend edits still in flight — otherwise switching images would
  // clobber the user's most recent tuning.
  const handleSelectVariant = useCallback(
    (index: number): void => {
      setSelectedVariant(index);

      const timers = blendTimers.current;
      const pending = Array.from(timers.keys());
      pending.forEach((id) => {
        const timer = timers.get(id);
        if (timer) {
          clearTimeout(timer);
        }
        timers.delete(id);
      });

      const flushed = Promise.all(
        pending.map((id) => blend.mutateAsync(toBlendInput(id, overrides[id] ?? {}))),
      );

      void flushed.then(() =>
        selectVariant.mutate(
          { variant: index },
          {
            onSuccess: (result) =>
              setCssOverrides((prev) => {
                const next = { ...prev };
                for (const patched of result.templates) {
                  next[patched.template_id] = patched.css;
                }
                return next;
              }),
          },
        ),
      );
    },
    [blend, overrides, selectVariant],
  );

  const templatesByCanvas = useMemo(() => {
    const templates = effectivePreview?.templates ?? [];
    const split: Record<Canvas, TemplatePreview[]> = { a4: [], a5: [] };
    templates.forEach((template) => split[template.canvas].push(template));
    return split;
  }, [effectivePreview]);

  const status = theme?.status ?? (generate.isPending ? 'generating' : null);
  const isBusy = generate.isPending || status === 'generating';

  return (
    <div className="min-h-svh text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-bright to-brand shadow-md shadow-brand/40">
              <HugeiconsIcon icon={PaintBoardIcon} className="size-4.5 text-white" />
            </div>
            <h1 className="font-display text-lg font-semibold tracking-tight">Theme Generator</h1>
          </div>
          <span className="rounded-full border border-border/80 bg-card/60 px-3 py-1 text-xs text-muted-foreground">
            Internal · myBillbook
          </span>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <PromptBar isGenerating={isBusy} onGenerate={handleGenerate} />

        {generate.isError ? (
          <p className="text-sm text-destructive">
            Couldn’t start generation: {generate.error.message}
          </p>
        ) : null}

        {status && status !== 'ready' ? (
          <StatusBanner
            status={status}
            errorMessage={theme?.error_message}
            onRetry={() => regenerate.mutate()}
            isRetrying={regenerate.isPending}
          />
        ) : null}

        {!status ? (
          <div className="flex animate-in flex-col items-center gap-4 rounded-2xl border border-dashed border-border/80 bg-card/40 px-6 py-20 text-center duration-500 fade-in slide-in-from-bottom-2">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-brand/15 ring-1 ring-brand/30">
              <HugeiconsIcon icon={AiMagicIcon} className="size-7 text-brand-bright" />
            </div>
            <div>
              <p className="font-display text-lg font-medium text-foreground">
                Describe a theme to get started
              </p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Your prompt becomes artwork variants, previewed live on every A4 and A5 invoice
                format.
              </p>
            </div>
          </div>
        ) : null}

        {isReady && theme ? (
          <>
            <div className="flex animate-in items-center justify-between duration-500 fade-in slide-in-from-bottom-2">
              <div className="min-w-0">
                <h2 className="truncate font-display text-2xl font-semibold tracking-tight">
                  {theme.name}
                </h2>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">{theme.slug}</p>
              </div>
              <DownloadButton themeId={theme.id} slug={theme.slug} />
            </div>

            {theme.a4_image_urls.length > 1 ? (
              <VariantStrip
                variants={theme.a4_image_urls}
                selected={selectedVariant}
                onSelect={handleSelectVariant}
              />
            ) : null}

            {previewQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-border/80 bg-card/60 px-6 py-16 text-muted-foreground">
                <HugeiconsIcon icon={Loading03Icon} className="size-5 animate-spin text-brand-bright" />
                <span className="text-sm">Loading previews…</span>
              </div>
            ) : null}

            {!previewQuery.isLoading && templatesByCanvas.a4.length + templatesByCanvas.a5.length === 0 ? (
              <div className="rounded-2xl border border-border/80 bg-card/60 px-6 py-16 text-center text-sm text-muted-foreground">
                No previews available for this theme.
              </div>
            ) : null}

            {(['a4', 'a5'] as const).map((canvas) => (
              <CanvasCarousel
                key={canvas}
                title={CANVAS_TITLES[canvas]}
                canvas={canvas}
                templates={templatesByCanvas[canvas]}
                activeIndex={activeIndex[canvas]}
                selectedSelector={selectedStrips[canvas]}
                overrides={overrides}
                themeOpacity={theme?.artwork_opacity ?? null}
                onNavigate={handleNavigate}
                onSelectStrip={handleSelectStrip}
                onArtworkOpacity={handleArtworkOpacity}
                onTemplateTint={handleTemplateTint}
                onTemplateTintClear={handleTemplateTintClear}
                onBlendMode={handleBlendMode}
                onStripEnabled={handleStripEnabled}
                onStripAlpha={handleStripAlpha}
                onStripTint={handleStripTint}
              />
            ))}
          </>
        ) : null}
      </main>
    </div>
  );
}
