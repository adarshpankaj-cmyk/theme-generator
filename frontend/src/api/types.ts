/**
 * TypeScript mirrors of the backend JSON contracts (backend/SPEC.md §8).
 * These are the single source of truth for every response/request shape the
 * frontend builds against.
 */

/** Canvas format. A4 = portrait 600×848, A5 = landscape 1024×724. */
export type Canvas = 'a4' | 'a5';

/** Theme lifecycle status (backend `Theme::STATUSES`). */
export type ThemeStatus = 'draft' | 'generating' | 'ready' | 'published' | 'failed';

/**
 * Known status values as a const map (guidelines: avoid magic strings). A
 * string-literal union is used for the type rather than a TS `enum` to keep the
 * values structurally identical to the raw JSON.
 */
export const ThemeStatusValue = {
  Draft: 'draft',
  Generating: 'generating',
  Ready: 'ready',
  Published: 'published',
  Failed: 'failed',
} as const satisfies Record<string, ThemeStatus>;

/** Per-strip blend settings, keyed by CSS selector. */
export interface StripSettings {
  readonly enabled?: boolean;
  readonly alpha?: number;
  readonly tint_hex?: string;
}

/** Per-template blend overrides layered over registry defaults (§4.1). */
export interface TemplateOverride {
  readonly artwork_opacity?: number;
  readonly tint_hex?: string;
  readonly strips?: Record<string, StripSettings>;
}

/** `blend_overrides` map, keyed by template id. */
export type BlendOverrides = Record<string, TemplateOverride>;

/** Canonical theme response object. */
export interface Theme {
  readonly id: number;
  readonly name: string;
  readonly slug: string;
  readonly prompt: string | null;
  readonly status: ThemeStatus;
  readonly tint_hex: string | null;
  readonly artwork_opacity: number | null;
  readonly a4_image_url: string | null;
  readonly a5_image_url: string | null;
  readonly blend_overrides: BlendOverrides;
  readonly error_message: string | null;
  readonly templates: readonly string[];
}

/** One template's preview payload (GET /themes/:id/preview). */
export interface TemplatePreview {
  readonly template_id: string;
  readonly canvas: Canvas;
  readonly css: string;
  readonly image_url: string | null;
  readonly base_invoice_html: string;
}

/** Preview grid payload. */
export interface PreviewResponse {
  readonly templates: readonly TemplatePreview[];
}

/** Async generation acknowledgement (POST generate/regenerate → 202). */
export interface GenerationAck {
  readonly id: number;
  readonly status: ThemeStatus;
}

/** Recomputed CSS for one template (PATCH /themes/:id/blend). */
export interface BlendResponse {
  readonly template_id: string;
  readonly css: string;
}

/** Publish result (POST /themes/:id/publish). */
export interface PublishResponse {
  readonly status: ThemeStatus;
}

/* ---- Request bodies ---- */

export interface CreateThemeInput {
  readonly name: string;
  readonly prompt: string;
}

export interface RegenerateInput {
  readonly prompt?: string;
}

/** Blend patch body. `template_id` targets the card; the rest are partial. */
export interface BlendInput {
  readonly template_id: string;
  readonly artwork_opacity?: number;
  readonly tint_hex?: string;
  readonly strips?: Record<string, StripSettings>;
}
