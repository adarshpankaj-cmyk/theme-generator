# Theme Render Migration Process

**Purpose:** Replace the placeholder stub in each preview card with the *real*
myBillbook invoice, by capturing the post-JS rendered DOM from the live app and
saving it as a body file the backend inlines.

This is a repeatable, per-template loop. Do it once per template.

_Last updated: 2026-07-07_

> **Automated path (preferred).** Instead of copying the whole page and hand-trimming,
> paste [backend/app/services/invoice_previews/capture_body.js](backend/app/services/invoice_previews/capture_body.js)
> into the invoice's DevTools Console. It finds the invoice (searching the top
> document **and** any same-origin `<iframe srcdoc>`), performs the entire trim in
> §3, refuses if the data is empty (Theme Store), and **downloads the finished
> `<template>.html`** — so nothing huge is pasted anywhere. Then just move the file
> from Downloads into `bodies/`. The browser may name it from the page title (e.g.
> `myBillBook Theme Five.html`); rename to `<template>.html` on the way in. The
> manual steps below remain the reference for what the script does.

---

## 0. Background (why this works)

Real invoices are drawn at runtime by a big JS engine (`invoice_renderer.js`)
that populates data and hides empty sections. A static skeleton renders blank,
so the only faithful source is the **rendered DOM captured from the live app**.

The backend ([invoice_preview.rb](backend/app/services/invoice_preview.rb))
assembles each preview as:

```
fonts_link  +  <style>invoice_box_common.css (+ A5 common)</style>
            +  <style><template>.css</style>
            +  <captured body markup>
```

So the file we save is **body markup ONLY** — no `<style>`, no `<script>`.
The two stylesheets already live in
`backend/app/services/invoice_previews/css/` and are inlined at request time.
That's why the raw saved file looks unstyled when opened alone — that's correct.

---

## 1. Capture (in the live myBillbook app)

1. Switch the invoice to the target layout (e.g. `theme_three`).
2. Let it **fully render** — no loading shimmer, all data populated.
3. Open DevTools Console. Make sure the frame dropdown (top of console) is on
   the invoice page/frame, not `top`/blank.
4. Run **exactly** this, nothing else:
   ```js
   copy(document.documentElement.outerHTML)
   ```
   `copy()` returns `undefined` — the HTML is on the clipboard. Paste it back to
   whoever is saving the file.

### Gotchas
- `Cannot read properties of null (reading 'contentDocument')` or
  `(reading 'outerHTML')` → you ran an **old command** from scrollback (an
  earlier version targeted `#invoice-preview-iframe`, which does not exist on
  this page — there is no iframe). Clear the line and run the clean command above.
- The invoice renders **directly into `<body>`** (class `invoice-shell-ready`),
  not inside an iframe. Don't look for an iframe.
- **Do NOT capture the Theme Store screen** (Settings → Themes; page URL contains
  `theme-store`, shows a grid of cards named *Advanced GST / Billbook / Luxury /
  Modern / Simple / Stylish …*). It renders each layout with **empty placeholder
  data** — labels but no company name, no invoice number, no item rows, no amounts.
  Saving that gives a blank skeleton, which is exactly what this migration avoids.
  The store's large preview is one `<iframe srcdoc>` (meta = selected template) but
  its data is still empty. **Capture from a real invoice's preview instead** (open an
  actual populated invoice, switch its theme to the target, let it render, then run
  the copy command) — that's the source the good `theme_seven/eight/luxury` files
  came from.

---

## 2. Identify the template (before saving)

Read the **invoice document's** `<meta name="description" content="...">` — it MUST
equal the template you intend to save (e.g. `theme_eight`). If it says something
else, the app didn't switch layouts; recapture. This is the #1 mistake — always verify.

**Where that meta lives:** on a real invoice the layout renders inside an
`<iframe srcdoc>`, and the template name is the meta *inside that iframe*. The
**top** document only carries the app's marketing SEO description (e.g. _"India's
best GST billing…"_) — do not read that one. `capture_body.js` handles this by
reaching into the iframe automatically; if capturing by hand, select the invoice
frame in the console's frame dropdown first.

Template → id map (from the app's `getThemeId`):
`theme_one`=1, `theme_two`=2, `theme_three`=3, `theme_four`=4 (A5),
`theme_five`=5, `theme_six`=6 (A5), `theme_seven`=7, `theme_eight`=8,
`theme_luxury`=10.

---

## 3. Trim + save (produce the body file)

Save to: `backend/app/services/invoice_previews/bodies/<template>.html`

From the pasted `<html>…</html>`, keep only the **body-level invoice markup**:

**KEEP** everything inside `<body>` that is invoice content:
- `.page-header` (if present)
- `#main-content` (the whole `<table>` with `#main-header`, the `.main-container`
  → `.page`, `#main-footer`)
- `.page-footer` (if present)
- For `theme_luxury` only: the decorative `#top-left-corner` … `#bottom-right-corner`
  gold SVGs (they define the look; keep them).

**DROP**:
- The entire `<head>` and every `<style>` block (backend inlines CSS).
- Every `<script>` block (Sentry, QRCode lib, the giant `invoice_renderer` bundle,
  the `luxury*Corner` SVG string vars at the end, etc.).
- Trailing helper divs: `#qr-code-flag-div`, `#finished-flag`.
- The `<body>` tag itself and its attributes (we store inner markup only).

**TRIM base64 image blobs** — replace each `src="data:image/...=="` (and the
company logo's long signed googleapis URL) with `src=""` and add a short `alt`.
These are huge and not needed for the overlay preview. Trim:
- `#company-logo`
- `#upi-apps > img`
- `#upi-qr-code`
- page-branding `img`

**Add a header comment** at the top of the file noting it's a captured body,
what layout it is, and that base64 blobs were trimmed. (See existing
`theme_seven.html` / `theme_eight.html` for the exact style.)

### Minor cleanups seen in real captures
- The app HTML-encodes some values oddly, e.g. a Facebook field renders as
  `[www.facebook.com/...](https://...)`. Fine to simplify to plain text.
- Whitespace/indentation doesn't matter functionally — tidy if easy.

---

## 4. Verify

The card auto-renders — **no frontend code changes**. To confirm end-to-end:
boot backend + frontend dev server (`frontend` config, port 5173), open the grid,
and check the `<Template> · A4` (or `· A5`) card renders like the real invoice,
tinted by the theme overlay. The stub fallback only shows for templates without
a saved body.

The raw `<template>.html` file opened alone will look unstyled — that's expected
(markup-only by design).

---

## 5. A5 templates (`theme_four`, `theme_six`)

Same process. The backend automatically also inlines `invoice_a5_common.css` for
these two (they're in `A5_TEMPLATES` in invoice_preview.rb). Canvas is
1024×724 (landscape) vs A4's 794×1123. Nothing extra to do on capture.

---

## 6. Status tracker

| Template | id | Captured? |
|----------|----|-----------|
| theme_seven | 7 | ✅ |
| theme_luxury | 10 | ✅ |
| theme_eight | 8 | ✅ |
| theme_three | 3 | ✅ |
| theme_five | 5 | ✅ |
| theme_four (A5) | 4 | ✅ |
| theme_six (A5) | 6 | ✅ |
| theme_one | 1 | ✅ |
| theme_two | 2 | ✅ |

**Suggested order** (most visually different from stub first): `theme_three` /
`theme_five` (boxed), then A5 pair `theme_four` / `theme_six`, then the simpler
`theme_one` / `theme_two`. Update the checkboxes as you go.

---

## 7. Quick reference (the whole loop)

1. App → switch to target layout → let it fully render.
2. Console → `copy(document.documentElement.outerHTML)` → paste.
3. Check `<meta name="description">` matches the target template.
4. Strip `<head>`/`<style>`/`<script>` + flag divs; keep the invoice markup.
5. Trim base64 `src`s (logo, UPI QR, UPI apps, branding) → `src=""`.
6. Save to `backend/app/services/invoice_previews/bodies/<template>.html`.
7. Card auto-renders. Tick the tracker.
