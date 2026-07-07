import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { PromptBar } from '@/components/prompt-bar';
import { PreviewGrid } from '@/components/preview-grid';
import { StatusBanner } from '@/components/status-banner';
import { Toolbar } from '@/components/toolbar';
import { BlendPanel } from '@/components/blend-panel';
import { DownloadButton } from '@/components/download-button';
import {
  useBlend,
  useGenerateTheme,
  useRegenerateTheme,
  useTheme,
  useThemePreview,
} from '@/hooks/use-themes';
import { withStripPatch, withTemplatePatch } from '@/lib/blend';
import type { BlendOverrides, CreateThemeInput, PreviewResponse, TemplateOverride } from '@/api/types';

/** Debounce window for blend PATCHes while dragging sliders (SPEC §5). */
const BLEND_DEBOUNCE_MS = 250;

interface Selection {
  readonly templateId: string;
  readonly selector: string | null;
}

/**
 * Root of the single-screen app (SPEC §3). Owns the current theme id, the blend
 * selection, and the local blend-overrides working copy, and wires the whole
 * generate → preview → blend loop.
 */
export function App(): JSX.Element {
  const [currentThemeId, setCurrentThemeId] = useState<number | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [overrides, setOverrides] = useState<BlendOverrides>({});
  const [cssOverrides, setCssOverrides] = useState<Record<string, string>>({});

  const generate = useGenerateTheme();
  const themeQuery = useTheme(currentThemeId);
  const theme = themeQuery.data;
  const regenerate = useRegenerateTheme(currentThemeId ?? 0);
  const blend = useBlend(currentThemeId ?? 0);

  const isReady = theme?.status === 'ready';
  const previewQuery = useThemePreview(currentThemeId, isReady);

  // Per-template debounce timers so edits to different cards don't cancel each other.
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

  // Reset transient blend state when switching themes.
  useEffect(() => {
    setSelection(null);
    setCssOverrides({});
  }, [currentThemeId]);

  // Strip-click messages from inside the preview iframes (SPEC §5).
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
          setSelection({ templateId, selector });
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
          blend.mutate(
            {
              template_id: templateId,
              artwork_opacity: override.artwork_opacity,
              tint_hex: override.tint_hex,
              strips: override.strips,
            },
            {
              onSuccess: (result) =>
                setCssOverrides((prev) => ({ ...prev, [result.template_id]: result.css })),
            },
          );
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

  const activeTemplateId = selection?.templateId ?? null;

  const effectivePreview: PreviewResponse | undefined = useMemo(() => {
    const data = previewQuery.data;
    if (!data || Object.keys(cssOverrides).length === 0) {
      return data;
    }
    return {
      templates: data.templates.map((template) =>
        cssOverrides[template.template_id]
          ? { ...template, css: cssOverrides[template.template_id] }
          : template,
      ),
    };
  }, [previewQuery.data, cssOverrides]);

  const status = theme?.status ?? (generate.isPending ? 'generating' : null);
  const isBusy = generate.isPending || status === 'generating';

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold">Theme Generator</h1>
          <span className="text-sm text-muted-foreground">Internal · myBillbook</span>
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
          <div className="rounded-xl border border-dashed bg-card/50 px-6 py-16 text-center text-muted-foreground">
            Enter a prompt above to generate a theme and preview it across every invoice format.
          </div>
        ) : null}

        {isReady && theme ? (
          <>
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold">{theme.name}</h2>
                <p className="font-mono text-xs text-muted-foreground">{theme.slug}</p>
              </div>
              <DownloadButton themeId={theme.id} slug={theme.slug} />
            </div>

            <Toolbar
              activeTemplateId={activeTemplateId}
              overrides={overrides}
              themeOpacity={theme?.artwork_opacity ?? null}
              onArtworkOpacity={(templateId, value) =>
                commit(templateId, withTemplatePatch(overrides, templateId, { artwork_opacity: value }))
              }
              onTemplateTint={(templateId, hex) =>
                commit(templateId, withTemplatePatch(overrides, templateId, { tint_hex: hex }))
              }
            />

            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              <div className="min-w-0 flex-1">
                <PreviewGrid
                  preview={effectivePreview}
                  isLoading={previewQuery.isLoading}
                  selectedTemplateId={activeTemplateId}
                  onSelectTemplate={(templateId) => setSelection({ templateId, selector: null })}
                />
              </div>

              {selection ? (
                <BlendPanel
                  templateId={selection.templateId}
                  selectedSelector={selection.selector}
                  overrides={overrides}
                  themeOpacity={theme?.artwork_opacity ?? null}
                  onSelectStrip={(selector) =>
                    setSelection({ templateId: selection.templateId, selector })
                  }
                  onStripEnabled={(selector, enabled) =>
                    commit(
                      selection.templateId,
                      withStripPatch(overrides, selection.templateId, selector, { enabled }),
                    )
                  }
                  onStripAlpha={(selector, alpha) =>
                    commit(
                      selection.templateId,
                      withStripPatch(overrides, selection.templateId, selector, { alpha }),
                    )
                  }
                  onStripTint={(selector, hex) =>
                    commit(
                      selection.templateId,
                      withStripPatch(overrides, selection.templateId, selector, { tint_hex: hex }),
                    )
                  }
                  onClose={() => setSelection(null)}
                />
              ) : null}
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
