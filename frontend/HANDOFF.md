# Frontend Handoff — Real Invoice Preview Integration

**Scope of this document:** the *frontend* only, and specifically the current activity —
making the preview grid render the **real myBillbook invoice** for each of the 9 templates
instead of the placeholder sample. Backend is otherwise complete; general frontend build
status (Phases 0–6) lives in the memory file `frontend-build-status.md` and is only
summarized here where it touches this activity.

_Last updated: 2026-07-07_

---

## 1. The problem we are solving

The preview cards were rendering a **placeholder skeleton** (`SampleInvoice`, the `[NEED]`
stub), which looks nothing like the real product. The user compared the generated preview
to the actual software and flagged the large visual gap.

**Root cause:** real invoices are drawn by a large JS engine (`invoice_box_common.js`) that
populates data at runtime and hides empty sections. A static skeleton renders blank. The
only faithful source is the **post-JS rendered DOM** captured from the live app.

**Decision (user):** *keep it accurate* — no artificial overlay boost to fake realism. We
render the actual rendered invoice body and let the theme overlay tint it exactly as the
live app does.

---

## 2. How the preview pipeline works (frontend side)

Each preview card is a **style-isolated iframe** built by
[`buildPreviewSrcDoc`](src/lib/preview-srcdoc.ts). The document is assembled in this exact
order (order matters — see below):

```
<!doctype html><html><head>
  <meta charset="utf-8">
  <style>html,body{margin:0;padding:0}</style>
</head><body>
  {preview.base_invoice_html}      ← backend: inlined invoice CSS + populated invoice body
  <style>{overlayCss}</style>      ← theme overlay, emitted LAST so its !important wins
  {stripClickScript}               ← optional; postMessages selector on strip click (blend)
</body></html>
```

Key invariants (do **not** regress these):

- **Overlay `<style>` must be emitted after the invoice's own CSS.** The invoice CSS uses
  `background: white !important` on strips like `.items-table-header`. `!important`
  conflicts resolve by **source order**, so the overlay has to come later to win. This
  mirrors how the live app injects the overlay stylesheet at the end of `<head>`.
- **Background-image rewrite is frontend-only.** The overlay CSS references the packaged
  `flash-themes/…` artwork path, which does not resolve inside the iframe. The backend
  does **not** rewrite it (despite SPEC §4 implying it should), so
  `rewriteBackgroundImage()` in [preview-srcdoc.ts](src/lib/preview-srcdoc.ts) swaps it for
  the payload's resolvable `image_url`.
- **A4 canvas is true page size: 794×1123** ([canvas.ts](src/lib/canvas.ts)). The real
  invoice body is 190mm wide + 10mm side padding; the old 600×848 clipped it. A5 stays
  1024×724 (landscape).

The iframe is scaled to fit its card via an `aspect-ratio` wrapper + `transform: scale()`
([preview-card.tsx](src/components/preview-card.tsx)), measured by a `ResizeObserver`
([use-measured-width.ts](src/hooks/use-measured-width.ts)).

---

## 3. What produces `base_invoice_html` (the one backend dependency)

The frontend does not fabricate invoice markup — it consumes `base_invoice_html` from
`GET /api/themes/:id/preview`. That field is produced by
[`InvoicePreview.html`](../backend/app/services/invoice_preview.rb):

- If a **captured rendered body** exists at `invoice_previews/bodies/<template>.html`, it
  inlines the real CSS (`invoice_box_common.css` + A5 common for `theme_four`/`theme_six` +
  `<template>.css`) followed by the populated body.
- Otherwise it falls back to the `SampleInvoice` stub.

**This is the crux of the remaining work:** each template needs its captured body file.
Only **`theme_seven`** (Pankaj Industries sample) is captured so far. The other 8 fall back
to the stub.

---

## 4. Completed (this activity)

- [x] `buildPreviewSrcDoc` emits overlay CSS **last** so theme tints beat invoice
      `!important` — [preview-srcdoc.ts](src/lib/preview-srcdoc.ts).
- [x] `rewriteBackgroundImage()` points overlay artwork at the resolvable `image_url`.
- [x] A4 canvas corrected to **794×1123** (no more clipping) — [canvas.ts](src/lib/canvas.ts).
- [x] `preview-card.tsx` srcDoc `useMemo` deps include `preview.image_url` and
      `definition?.selectors` so cards re-render when either changes.
- [x] Verified end-to-end for **theme_seven**: the "Seven · A4" card renders the full real
      Pankaj Industries invoice with the Ganesh overlay tint on `.items-table-header` /
      `#invoice-details-meta` (computed bg `rgb(245,244,240)` = `#F5F4F0`) plus the faint
      watermark. Other cards correctly show the stub fallback.
- [x] Removed the temporary `?id` loader seam from [App.tsx](src/App.tsx); build is clean.

---

## 5. Next steps (to finish all 9 templates)

The mechanism is proven and requires **no further frontend code changes** — only captured
bodies on the backend. For each remaining template:

1. In the live myBillbook app, switch the invoice to the target layout.
2. Capture the rendered DOM from the console:
   ```js
   copy(document.getElementById('invoice-preview-iframe').contentDocument.documentElement.outerHTML)
   ```
   (`copy()` returns `undefined` — the content is on the clipboard; paste it here.)
3. I trim base64 image blobs and save the body to
   `backend/app/services/invoice_previews/bodies/<template>.html`.
4. The card starts rendering the real invoice automatically.

**Remaining templates (8):** `theme_luxury`, `theme_one`, `theme_two`, `theme_three`,
`theme_four` (A5), `theme_five`, `theme_six` (A5), `theme_eight`.

**Suggested capture order** (most visually different from the stub, highest payoff first):
1. `theme_eight` / `theme_three` / `theme_five` — boxed advanced-GST layouts (the one in
   the user's original side-by-side screenshot).
2. `theme_four` / `theme_six` — the A5 landscape layouts (exercise the A5 CSS path).
3. The remaining simpler layouts.

One rendered paste per distinct layout is enough.

---

## 6. Frontend files that matter for this activity

| File | Role in this activity |
|------|----------------------|
| [src/lib/preview-srcdoc.ts](src/lib/preview-srcdoc.ts) | Builds the isolated iframe doc; overlay-last ordering + background-image rewrite + strip-click script. |
| [src/lib/canvas.ts](src/lib/canvas.ts) | A4 794×1123 / A5 1024×724 native sizes. |
| [src/components/preview-card.tsx](src/components/preview-card.tsx) | Scaled iframe, `isSelected`, `onSelectTemplate`, srcDoc memo deps. |
| [src/components/preview-grid.tsx](src/components/preview-grid.tsx) | Grid of cards, gated on theme `ready`. |
| [src/lib/template-registry.ts](src/lib/template-registry.ts) | Frontend mirror of the 9 templates' strip selectors (the `/preview` payload omits them). |
| [src/App.tsx](src/App.tsx) | Owns theme id, selection, blend overrides; merges blend CSS into `effectivePreview`. |
| [src/api/themes.ts](src/api/themes.ts) / [src/hooks/use-themes.ts](src/hooks/use-themes.ts) | Typed client + React Query hooks (2s generate poll). |

**Backend touch-point (context only, not frontend work):**
[invoice_preview.rb](../backend/app/services/invoice_preview.rb) and
[previews_controller.rb](../backend/app/controllers/api/previews_controller.rb) — where the
captured bodies get inlined.

---

## 7. Environment / gotchas

- API base URL is **`http://127.0.0.1:3007/api`** in `frontend/.env` — **not** the
  `localhost:3000` from SPEC (wrong on this machine). `.env.example` still says 3000
  (minor, unfixed).
- Backend must be booted with the rbenv/postgres PATH prefix (see `backend-dev-env`
  memory) before previews return real data.
- Dev server: `.claude/launch.json` config **"frontend"** (`npm --prefix frontend run dev`,
  port 5173).
- Selector compatibility confirmed: the overlay tints the same classes the real invoice
  engine tints (`setInvoiceColors` → `.items-table-header`, `.items-table-total`,
  `.tax-table-header`, `.title-bill-ship-to`), matching the frontend registry.

---

## 8. Out of scope for this activity (deferred, not requested now)

- Regenerate / Publish buttons (publish backend returns 501 until `PUBLISH_API_URL` is set).
- Theme persistence across reload (`currentThemeId` resets to `null`).
- Backend-side image-path rewrite (frontend compensates).
- "Clear tint to default" (backend blend updater only merges, never unsets).
