# Theme Generator — Frontend Build Spec

Companion to [`README.md`](README.md). The README is the feature map; this is the exact build contract. Build **after** the backend API exists. Root context: [`../README.md`](../README.md) · backend contract: [`../backend/SPEC.md`](../backend/SPEC.md) §8.

The frontend is thin: all theme logic (generation, CSS assembly, tint, blend resolution) is backend. The frontend's job is the **single-screen loop** — prompt → see all invoices → nudge → publish — and its one hard part is rendering 9 isolated invoice previews with clickable strips.

---

## 1. Stack & setup

- **Vite + React + TypeScript.** Deploys to Vercel with zero config.
- **Server state + polling:** TanStack Query (React Query). Generation is async — we poll `GET /themes/:id` until `ready`.
- **Styling:** Tailwind (fast for an internal tool); swappable. Desktop-first — this is an internal PM tool, not mobile.
- **HTTP:** a thin `api.ts` fetch wrapper. Base URL from `VITE_API_BASE_URL`.
- Scaffold: `npm create vite@latest frontend -- --template react-ts`.

---

## 2. Screen anatomy (one screen)

```
┌───────────────────────────────────────────────────────────────┐
│  [ prompt input ......................... ]  [ Generate ]       │  PromptBar
├───────────────────────────────────────────────────────────────┤
│  Toolbar:  artwork opacity ▮▮▮▯▯   [Regenerate] [Download] [Publish] │
├──────────────────────────────────────────┬────────────────────┤
│  PreviewGrid (9 cells, one per template)  │  BlendPanel        │
│  ┌────────┐ ┌────────┐ ┌────────┐         │  (contextual —     │
│  │ luxury │ │ one    │ │ two    │  …      │   appears when a   │
│  │ [iframe]│ │[iframe]│ │[iframe]│        │   strip is picked) │
│  └────────┘ └────────┘ └────────┘         │  • enabled toggle  │
│  A4 cells + A5 cells (four/six) labelled  │  • alpha slider    │
│                                           │  • tint color      │
└──────────────────────────────────────────┴────────────────────┘
   StatusBanner overlays while status = generating | failed
```

---

## 3. Component tree

- `App` — holds `currentThemeId`, wires React Query.
- `PromptBar` — text input + Generate; on submit → create + generate (§6).
- `StatusBanner` — spinner while `generating`; error + Retry while `failed`.
- `Toolbar` — global artwork-opacity slider (applies to selected template, or "all"), Regenerate, Download, Publish.
- `PreviewGrid` — maps over `preview.templates`, renders a `PreviewCard` each.
- `PreviewCard` — one template: labelled iframe (§4), highlights when selected.
- `BlendPanel` — controls for the currently selected `{ template, strip }` (§5).

---

## 4. Preview rendering — the one hard part

Each cell renders the **base invoice HTML + the overlay CSS**, fully **style-isolated** so the overlay's `body::before` / `.items-table-header` rules don't leak into the app. Use an **iframe via `srcdoc`**.

For each template, `GET /themes/:id/preview` returns `{ template_id, canvas, css, image_url, base_invoice_html }` (backend SPEC §8). Compose the srcdoc:

```html
<!doctype html><html><head>
  <style>{{css}}</style>
</head><body>
  {{base_invoice_html}}
  <script>{{strip-click capture, §5}}</script>
</body></html>
```

**Two integration contracts the backend must honor (coordinate — noted in backend SPEC §8/§10):**
1. **Preview CSS must use a resolvable image URL.** The packaged CSS points at `./flash-themes/<slug>/images/a4.jpeg`, which won't resolve in an iframe. So the `css` returned by `/preview` (and `/blend`) must have its `background-image` rewritten to the real `image_url`. The *download/publish* folder keeps the canonical `flash-themes` path.
2. `base_invoice_html` is body-level markup (the invoice), not a full document — the frontend supplies the `<html>/<head>` wrapper. If the backend can only send stub HTML until the real invoice markup arrives ([NEED] in backend SPEC §10), the previews still work; they just aren't pixel-real yet.

Sizing: scale each iframe down to fit the card (`transform: scale(...)` on a fixed-dimension iframe set to the canvas px, so 600×848 / 1024×724 render true-to-ratio).

---

## 5. Blend interaction (matches the "click the part" mockup)

**Selecting a strip:** inject a small script into each preview's srcdoc that attaches click listeners to that template's known selectors (the registry selector list, passed in) and `postMessage`s the clicked selector to the parent:

```js
const SELECTORS = {{json array of this template's selectors}};
SELECTORS.forEach(sel => document.querySelectorAll(sel).forEach(el => {
  el.style.cursor = 'pointer';
  el.addEventListener('click', e => {
    e.preventDefault();
    parent.postMessage({ type: 'strip-click', templateId: '{{template_id}}', selector: sel }, '*');
  });
}));
```

The parent listens on `window`'s `message` event, and on `strip-click` sets `selected = { templateId, selector }` → opens `BlendPanel`. (srcdoc iframes are same-ish origin; accept only `type: 'strip-click'` messages and ignore anything else.) Fallback if click-capture is flaky: `BlendPanel` also lists the template's strips by name to pick from.

**Adjusting (BlendPanel controls):**
- Per selected strip: **enabled** toggle, **alpha** slider (0–1), optional **tint** color.
- Template-level (Toolbar): **artwork opacity** slider, template **tint** color.

**On any change → `PATCH /themes/:id/blend`** with `{ template_id, artwork_opacity?, tint_hex?, strips? }`. The response `{ template_id, css }` replaces that card's srcdoc → live update.
- **Debounce** slider PATCHes ~250ms.
- **Optimistic feel:** apply the change locally to the iframe's CSS immediately, then reconcile with the returned `css`. Every control maps to one variable, so local and server results match — no flicker.

---

## 6. Lifecycle / data flow

1. **Generate:** `POST /themes {name, prompt}` → `POST /themes/:id/generate` → set `currentThemeId`, status `generating`.
2. **Poll:** React Query polls `GET /themes/:id` (e.g. every 2s) while status is `generating`; stop on `ready`/`failed`.
3. **Ready:** `GET /themes/:id/preview` → render `PreviewGrid`.
4. **Tune:** select strip → adjust → debounced `PATCH /blend` → card updates.
5. **Regenerate:** `POST /themes/:id/regenerate {prompt?}` → back to `generating`.
6. **Publish:** `POST /themes/:id/publish` → success state. (`Download` hits `GET /themes/:id/download` for the zip — useful before the publish API exists.)

Deriving `name` vs `slug`: user types a display name in PromptBar (or reuse the prompt's subject); backend slugifies. Frontend just shows `theme.name`/`theme.slug` from responses.

---

## 7. Env

```
VITE_API_BASE_URL=http://localhost:3000/api    # Rails backend
```

---

## 8. Verification

- **Generate flow:** submit a prompt → spinner → grid of 9 previews appears, A5 cells (`theme_four`, `theme_six`) visibly landscape.
- **Live blend:** drag artwork-opacity → that preview updates within ~250ms, no full reload.
- **Strip select:** click a header strip inside a preview → BlendPanel opens for that exact selector.
- **Disable strip:** toggle `.page-footer` off on `theme_one` → the tinted footer band disappears in the preview.
- **Publish:** click Publish → success state; `Download` returns a zip whose folder matches a real theme folder.
- **Isolation check:** confirm overlay CSS (`body::before`, table tints) affects only the iframes, never the app chrome.
```
