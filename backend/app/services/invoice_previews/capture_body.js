/*
 * Theme body capture — run in the live myBillbook invoice's DevTools Console.
 *
 * Replaces the manual "copy outerHTML → paste into chat → hand-trim" loop.
 * It performs the whole trim client-side (see THEME_RENDER_MIGRATION_PROCESS.md
 * step 3) and DOWNLOADS the finished <template>.html body file, so nothing huge
 * is ever pasted into chat.
 *
 * The invoice may render inside an <iframe srcdoc> (the app shell's top document
 * only carries the marketing SEO meta). This script searches the top document
 * AND every same-origin iframe, so you do NOT need to select a frame in the
 * console's frame dropdown.
 *
 * Usage:
 *   1. Open a REAL populated invoice, switch it to the target layout, let it
 *      fully render (no shimmer).
 *   2. Open Console, paste this whole file, press Enter.
 *   3. It prints the detected template + a sanity check, then downloads
 *      <template>.html to your Downloads folder. Move that into
 *      backend/app/services/invoice_previews/bodies/.
 *
 * Detection wrong? Force it: captureInvoiceBody('theme_five')
 * Refuses ("empty data")? You're on the Theme Store preview, not a real
 *   invoice — open an actual populated invoice and retry.
 */
window.captureInvoiceBody = function captureInvoiceBody(forceTemplate) {
  // --- 1. Find the document that actually holds the invoice ----------------
  // Search the top document and every reachable (same-origin) iframe.
  const frames = [{ doc: document, frame: null }];
  document.querySelectorAll('iframe').forEach((frame) => {
    try {
      if (frame.contentDocument) frames.push({ doc: frame.contentDocument, frame });
    } catch (e) { /* cross-origin — skip */ }
  });

  const hit = frames.find(({ doc }) => doc.querySelector('#main-content'));
  if (!hit) {
    console.error(
      '[capture] No #main-content in the top document or any same-origin iframe. ' +
      'Is the invoice fully rendered? Aborting.');
    return;
  }
  const { doc, frame } = hit;

  // --- 2. Identify the template -------------------------------------------
  let template = (forceTemplate || '').trim();
  if (!template) {
    const meta = doc.querySelector('meta[name="description"]');
    const c = (meta && meta.content || '').trim();
    if (/^theme_[a-z0-9]+$/.test(c)) template = c;
  }
  if (!template && frame) {
    const m = (frame.getAttribute('srcdoc') || '').match(/theme_[a-z0-9]+/);
    if (m) template = m[0];
  }
  if (!/^theme_[a-z0-9]+$/.test(template)) {
    console.error(
      '[capture] Could not determine the template (found "%s"). ' +
      'Re-run with an explicit name, e.g. captureInvoiceBody(\'theme_five\').',
      template);
    return;
  }

  // --- 3. Guard against the empty-data Theme Store preview -----------------
  const companyName = doc.querySelector('#company-name');
  if (!companyName || !companyName.textContent.trim()) {
    console.error(
      '[capture] %s has no #company-name data — this looks like the Theme Store ' +
      'preview (empty placeholder), not a real invoice. Aborting so you don\'t ' +
      'save a blank skeleton.', template);
    return;
  }

  // --- 4. Collect the body-level invoice markup, in document order ---------
  // Keep .page-header, #main-content, .page-footer, plus luxury corner SVGs.
  const KEEP = [
    '.page-header',
    '#main-content',
    '.page-footer',
    '#top-left-corner', '#top-right-corner',
    '#bottom-left-corner', '#bottom-right-corner',
  ];
  const kept = [...doc.body.children].filter((el) =>
    KEEP.some((sel) => el.matches(sel)));

  if (!kept.some((el) => el.matches('#main-content'))) {
    console.error('[capture] #main-content is not a direct body child — nothing to save. Aborting.');
    return;
  }

  // --- 5. Clone + scrub each kept node ------------------------------------
  const DROP_INSIDE = 'script, style, noscript, #qr-code-flag-div, #finished-flag';
  const isHeavySrc = (src) =>
    src.startsWith('data:') || /googleusercontent|googleapis|storage\.googleapis/.test(src);

  const scrub = (root) => {
    root.querySelectorAll(DROP_INSIDE).forEach((n) => n.remove());
    root.querySelectorAll('img[src]').forEach((img) => {
      if (isHeavySrc(img.getAttribute('src') || '')) {
        if (!img.getAttribute('alt')) {
          img.setAttribute('alt', (img.id || 'image').replace(/[-_]/g, ' '));
        }
        img.setAttribute('src', '');
      }
    });
    return root;
  };

  const markup = kept
    .map((el) => scrub(el.cloneNode(true)).outerHTML)
    .join('\n');

  const header =
    `<!-- Rendered ${template} invoice (post-JS DOM captured from the live app).\n` +
    `     Body markup only — no <head>/<style>/<script> (backend inlines CSS).\n` +
    `     Base64/remote image blobs (logo / UPI QR / UPI apps / branding) trimmed\n` +
    `     to src="" for size; not needed for the theme overlay preview. -->\n`;

  const file = header + markup + '\n';

  // --- 6. Download <template>.html ----------------------------------------
  const blob = new Blob([file], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${template}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  console.log(
    '[capture] ✓ %s (from %s) — %d block(s), %d chars. Downloaded %s.html. ' +
    'Move it into backend/app/services/invoice_previews/bodies/.',
    template, frame ? 'iframe' : 'top document', kept.length, file.length, template);
};
window.captureInvoiceBody();
