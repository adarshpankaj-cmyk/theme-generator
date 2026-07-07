import type { Canvas } from '@/api/types';

/** Native pixel dimensions of a rendered invoice canvas. */
export interface CanvasDimensions {
  readonly width: number;
  readonly height: number;
}

/**
 * Native canvas sizes (root README / SPEC §4). A4 is portrait, A5 is landscape;
 * previews are rendered at these exact pixel sizes inside the iframe and scaled
 * down to fit their card, preserving the true aspect ratio.
 */
export const CANVAS_DIMENSIONS: Record<Canvas, CanvasDimensions> = {
  // A4 rendered at true page px (210×297mm ≈ 794×1123 at 96dpi) so the real
  // invoice markup (body width 190mm + 10mm side padding) fits without clipping.
  a4: { width: 794, height: 1123 },
  a5: { width: 1024, height: 724 },
};
