import type { Canvas } from '@/api/types';

/**
 * Frontend mirror of the backend template registry
 * (`backend/config/theme_templates.yml`).
 *
 * WHY THIS EXISTS: the `GET /themes/:id/preview` payload does NOT include each
 * template's selector list, but the blend strip-click flow (SPEC §5) needs it
 * to wire click listeners inside each preview iframe. Selectors are stable,
 * deterministic per layout — mirroring them here is the intended "passed in"
 * selector source. Keep in sync with the YAML (order matters).
 */
export interface TemplateDefinition {
  readonly id: string;
  readonly canvas: Canvas;
  readonly layout: string;
  readonly defaultOpacity: number;
  readonly selectors: readonly string[];
}

const ADVANCED_GST_SELECTORS: readonly string[] = [
  '.items-table-header',
  '.tax-table-header',
  '.items-table-total',
  '.items-table-total-foreign',
  'td[class^="items-table-tax-total-"]',
  '.items-table-balance',
  '.items-table-received',
  '.items-table-prev-balance',
  '.items-table-total-payable',
  '.items-table-tax-tds',
  '.items-table-curr-balance',
  '.items-table-linked-cndn-record',
];

export const TEMPLATE_REGISTRY: readonly TemplateDefinition[] = [
  {
    id: 'theme_luxury',
    canvas: 'a4',
    layout: 'luxury',
    defaultOpacity: 0.35,
    selectors: [
      '.items-table-header',
      '.tax-table-header',
      '.items-table-total',
      '.items-table-total-foreign',
    ],
  },
  {
    id: 'theme_one',
    canvas: 'a4',
    layout: 'modern_a',
    defaultOpacity: 0.35,
    selectors: [
      '.title-bill-ship-to',
      '.items-table-total',
      '.items-table-total-foreign',
      '.items-table-header',
      '.tax-table-header',
      '.page-footer',
    ],
  },
  {
    id: 'theme_two',
    canvas: 'a4',
    layout: 'modern_b',
    defaultOpacity: 0.35,
    selectors: [
      '.title-bill-ship-to',
      '.items-table-header',
      '.items-table-total',
      '.items-table-total-foreign',
      '.tax-table-header',
      '.page-footer',
    ],
  },
  {
    id: 'theme_three',
    canvas: 'a4',
    layout: 'adv_gst_full_row',
    defaultOpacity: 0.35,
    selectors: ADVANCED_GST_SELECTORS,
  },
  {
    id: 'theme_four',
    canvas: 'a5',
    layout: 'a5_short',
    defaultOpacity: 0.35,
    selectors: [
      '.items-table-header',
      '.items-table-total',
      '.items-table-total-foreign',
      '.tax-table-header',
    ],
  },
  {
    id: 'theme_five',
    canvas: 'a4',
    layout: 'adv_gst_tally_full_row',
    defaultOpacity: 0.35,
    selectors: ADVANCED_GST_SELECTORS,
  },
  {
    id: 'theme_six',
    canvas: 'a5',
    layout: 'a5_full_row',
    defaultOpacity: 0.35,
    selectors: [
      '.items-table-header',
      '.items-table-total',
      '.items-table-total-foreign',
      'td[class^="items-table-tax-total-"]',
      '.items-table-balance',
      '.items-table-received',
      '.items-table-prev-balance',
      '.items-table-total-payable',
      '.items-table-tax-tds',
      '.items-table-curr-balance',
      '.items-table-linked-cndn-record',
      '.tax-table-header',
    ],
  },
  {
    id: 'theme_seven',
    canvas: 'a4',
    layout: 'stylish',
    defaultOpacity: 0.35,
    selectors: [
      '#invoice-details-meta',
      '.items-table-total',
      '.items-table-header',
      '.page-footer',
      '.tax-table-header',
    ],
  },
  {
    id: 'theme_eight',
    canvas: 'a4',
    layout: 'billbook_full_row',
    defaultOpacity: 0.35,
    selectors: ADVANCED_GST_SELECTORS,
  },
];

const REGISTRY_BY_ID: ReadonlyMap<string, TemplateDefinition> = new Map(
  TEMPLATE_REGISTRY.map((template) => [template.id, template]),
);

/** Look up a template definition by id, or `undefined` if unknown. */
export function findTemplate(id: string): TemplateDefinition | undefined {
  return REGISTRY_BY_ID.get(id);
}

/** Human-readable label for a template card (e.g. "theme_four" → "Four · A5"). */
export function templateLabel(template: TemplateDefinition): string {
  const name = template.id.replace(/^theme_/, '');
  const title = name.charAt(0).toUpperCase() + name.slice(1);
  return `${title} · ${template.canvas.toUpperCase()}`;
}
