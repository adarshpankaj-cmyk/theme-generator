import type { BlendMode, BlendOverrides, StripSettings, TemplateOverride } from '@/api/types';
import { findTemplate } from '@/lib/template-registry';

const FALLBACK_OPACITY = 0.6;

/**
 * A strip's opacity is a *relative* multiplier on the template opacity, so an
 * un-customized strip sits at 1.0 (full = same as the artwork opacity). This
 * matches the backend, which renders default strips at the effective opacity.
 */
export const STRIP_DEFAULT_ALPHA = 1;

/** Default blend mode when a template has no override (matches the backend). */
export const DEFAULT_BLEND_MODE: BlendMode = 'multiply';

/** The override entry for a template, or an empty object. */
export function templateOverride(overrides: BlendOverrides, templateId: string): TemplateOverride {
  return overrides[templateId] ?? {};
}

/** The stored settings for a strip, or an empty object. */
export function stripSettings(
  overrides: BlendOverrides,
  templateId: string,
  selector: string,
): StripSettings {
  return templateOverride(overrides, templateId).strips?.[selector] ?? {};
}

/** Effective artwork opacity: template override → theme default → registry default. */
export function effectiveOpacity(
  overrides: BlendOverrides,
  templateId: string,
  themeOpacity: number | null,
): number {
  const override = templateOverride(overrides, templateId).artwork_opacity;
  if (override !== undefined) {
    return override;
  }
  if (themeOpacity !== null) {
    return themeOpacity;
  }
  return findTemplate(templateId)?.defaultOpacity ?? FALLBACK_OPACITY;
}

/** Whether a strip is enabled (defaults to true when unset). */
export function isStripEnabled(
  overrides: BlendOverrides,
  templateId: string,
  selector: string,
): boolean {
  return stripSettings(overrides, templateId, selector).enabled ?? true;
}

/**
 * Effective per-strip opacity multiplier (0–1), defaulting to `STRIP_DEFAULT_ALPHA`
 * (full). This is *relative* to the template opacity — the rendered tint alpha is
 * `artwork_opacity × this` — so an un-customized strip reads 100%, matching what
 * the backend actually paints.
 */
export function effectiveStripAlpha(
  overrides: BlendOverrides,
  templateId: string,
  selector: string,
): number {
  return stripSettings(overrides, templateId, selector).alpha ?? STRIP_DEFAULT_ALPHA;
}

/** Effective template blend mode: override → default `multiply`. */
export function effectiveBlendMode(overrides: BlendOverrides, templateId: string): BlendMode {
  return templateOverride(overrides, templateId).blend_mode ?? DEFAULT_BLEND_MODE;
}

/** Immutably merge a template-level patch into the overrides map. */
export function withTemplatePatch(
  overrides: BlendOverrides,
  templateId: string,
  patch: Partial<TemplateOverride>,
): BlendOverrides {
  return {
    ...overrides,
    [templateId]: { ...templateOverride(overrides, templateId), ...patch },
  };
}

/** Immutably drop the template-level tint override, reverting to the inherited default. */
export function withTemplateTintCleared(
  overrides: BlendOverrides,
  templateId: string,
): BlendOverrides {
  const { tint_hex: _cleared, ...rest } = templateOverride(overrides, templateId);
  return { ...overrides, [templateId]: rest };
}

/** Immutably merge a strip-level patch into the overrides map. */
export function withStripPatch(
  overrides: BlendOverrides,
  templateId: string,
  selector: string,
  patch: Partial<StripSettings>,
): BlendOverrides {
  const current = templateOverride(overrides, templateId);
  const strips = { ...(current.strips ?? {}) };
  strips[selector] = { ...(strips[selector] ?? {}), ...patch };
  return { ...overrides, [templateId]: { ...current, strips } };
}
