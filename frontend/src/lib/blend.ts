import type { BlendOverrides, StripSettings, TemplateOverride } from '@/api/types';
import { findTemplate } from '@/lib/template-registry';

const FALLBACK_OPACITY = 0.35;

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

/** Effective per-strip alpha, falling back to the template's effective opacity. */
export function effectiveStripAlpha(
  overrides: BlendOverrides,
  templateId: string,
  selector: string,
  fallback: number,
): number {
  return stripSettings(overrides, templateId, selector).alpha ?? fallback;
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
