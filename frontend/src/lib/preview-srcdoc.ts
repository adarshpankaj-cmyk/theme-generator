import type { TemplatePreview } from '@/api/types';

/**
 * Compose the fully style-isolated iframe document for one preview (SPEC §4).
 *
 * The overlay CSS (`body::before`, table tints, etc.) must not leak into the
 * app chrome, so each preview is its own document: the backend supplies the
 * body-level invoice markup and the overlay CSS, and we wrap it in the html/head
 * shell.
 *
 * The overlay CSS's `background-image` points at the packaged `flash-themes/…`
 * path, which does not resolve inside an iframe (SPEC §4, integration contract
 * #1). The backend does not rewrite it, so we do: swap it for the resolvable
 * `image_url` from the same payload.
 *
 * The overlay `<style>` is emitted LAST (after the invoice's own CSS, which the
 * backend inlines into `base_invoice_html`). The invoice CSS uses `!important`
 * (e.g. `.items-table-header { background: white !important }`), so `!important`
 * conflicts resolve by source order — the overlay must come after to win, which
 * mirrors how the live app injects the overlay stylesheet at the end of <head>.
 *
 * `selectors` is optional: when provided, a click-capture script is injected so
 * strips postMessage their selector to the parent (the blend flow, SPEC §5).
 *
 * The `<body>` carries `invoice-shell-ready`: the invoice's own CSS hides an
 * unpopulated shell behind an opaque grey `body:not(.invoice-shell-ready)::before`
 * overlay (the live app clears it via JS once the renderer paints). Our previews
 * are pre-populated (captured markup), so the shell is ready from first paint —
 * without this class the guard's `::before` collides with (and, being more
 * specific, overrides) the overlay artwork `body::before`, replacing the artwork
 * with a grey sheet on top of the invoice that the opacity slider then fades.
 */
export function buildPreviewSrcDoc(
  preview: Pick<TemplatePreview, 'template_id' | 'css' | 'base_invoice_html' | 'image_url'>,
  selectors?: readonly string[],
): string {
  const script =
    selectors && selectors.length > 0 ? stripClickScript(preview.template_id, selectors) : '';
  const overlayCss = rewriteBackgroundImage(preview.css, preview.image_url);

  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    '<style>html,body{margin:0;padding:0}</style>',
    '</head><body class="invoice-shell-ready">',
    preview.base_invoice_html,
    `<style>${overlayCss}</style>`,
    script,
    '</body></html>',
  ].join('');
}

/** Point the overlay's `background-image` at the resolvable image URL. */
function rewriteBackgroundImage(css: string, imageUrl: string | null): string {
  if (!imageUrl) {
    return css;
  }
  return css.replace(
    /background-image:\s*url\((['"]?)[^)]*\1\)/g,
    `background-image: url("${imageUrl}")`,
  );
}

/**
 * Inline click-capture script: attaches listeners to the template's known
 * selectors and posts the clicked selector to the parent window. Kept minimal
 * and self-contained so it runs inside the sandboxed iframe.
 */
function stripClickScript(templateId: string, selectors: readonly string[]): string {
  const payload = JSON.stringify(selectors);
  return `<script>(function(){
    var SELECTORS = ${payload};
    SELECTORS.forEach(function(sel){
      document.querySelectorAll(sel).forEach(function(el){
        el.style.cursor = 'pointer';
        el.addEventListener('click', function(e){
          e.preventDefault();
          parent.postMessage({ type: 'strip-click', templateId: ${JSON.stringify(templateId)}, selector: sel }, '*');
        });
      });
    });
  })();</script>`;
}
