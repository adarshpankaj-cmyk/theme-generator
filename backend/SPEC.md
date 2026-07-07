# Theme Generator — Backend Build Spec

Companion to [`README.md`](README.md). The README says *what* to build; this says *exactly how*, with the verbatim contracts a fresh session needs to build end-to-end without guessing. Root context: [`../README.md`](../README.md) · [`../context.md`](../context.md).

Ground truth for every output shape below: the reference themes at `~/Downloads/Themes/` (canonical example: `ganesh/`).

---

## 1. Runtime & setup

- **Ruby** 3.2+ · **Rails 7.x in API mode** · **PostgreSQL** (needed for the JSONB overrides column).
- Scaffold: `rails new backend --api -d postgresql` (this folder is the target).
- **Gems:**
  - `image_processing` + `ruby-vips` — resize to exact px, sample palette for tint (libvips must be installed: `brew install vips`).
  - `faraday` (+ `faraday-multipart`) — OpenRouter HTTP calls.
  - `sidekiq` (or the built-in `:async` ActiveJob adapter for local dev) — async image generation.
  - `dotenv-rails` — env in dev.
  - `rubyzip` — package the theme folder for download/publish.
  - Later: `aws-sdk-s3` for ActiveStorage on AWS.
- **ActiveStorage** for the two generated images (local disk in dev, S3 later).

---

## 2. The output contract (must match byte-for-byte after normalization)

Every theme produces this folder, identical in shape to `~/Downloads/Themes/ganesh/`:

```
<overlay_name>/
├── .overlay_name              # exactly the slug, no newline, e.g. "ganesh"
├── images/
│   ├── a4.jpeg                # portrait 600×848, JPEG
│   └── a5.jpeg                # landscape 1024×724, JPEG
└── css/
    ├── theme_luxury/latest.css
    ├── theme_one/latest.css
    ├── theme_two/latest.css
    ├── theme_three/latest.css
    ├── theme_four/latest.css   # A5
    ├── theme_five/latest.css
    ├── theme_six/latest.css    # A5
    ├── theme_seven/latest.css
    └── theme_eight/latest.css
```

### 2.1 Canonical `latest.css` template

Every CSS file is this exact string with 5 substitutions. **Emit it normalized** (LF line endings, no trailing whitespace, one blank line where shown):

```css
body {
  position: relative;
  transform: translate(0%, 0%) scale(1);
}

body::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: url("./flash-themes/{{OVERLAY_NAME}}/images/{{CANVAS}}.jpeg");
  background-size: cover;
  background-position: center;
  opacity: {{OPACITY}};
  z-index: -1;
  pointer-events: none;
}
{{SELECTOR_LIST}} {
  background-color: {{TINT_HEX}} !important;
  mix-blend-mode: multiply !important;
}
```

Substitutions:
| Token | Source | Notes |
|---|---|---|
| `{{OVERLAY_NAME}}` | theme slug | **Must equal the folder name.** This is the deployed path; images live at `flash-themes/<slug>/images/` in the app. |
| `{{CANVAS}}` | `a4` or `a5` | Per template (see registry). |
| `{{OPACITY}}` | effective opacity | Default `0.35`. |
| `{{SELECTOR_LIST}}` | per template | The comma-joined selectors from §3, each on its own line. |
| `{{TINT_HEX}}` | computed tint | See §5. |

### 2.2 Normalization decisions (source has inconsistencies — standardize these)

- The reference source drops `transform: translate(0%, 0%) scale(1);` in `theme_three` and adds trailing spaces after some `url(...)`. **Always** include the `transform` line and **never** emit trailing whitespace.
- Source uses `mix-blend-mode: multiply;` in some files and `multiply !important;` in others. **Always emit `!important`** — it's safer against the base invoice CSS.
- These normalizations mean a golden test must compare *normalized* strings, not raw source bytes (see §9).

---

## 3. Template Registry (the deterministic core)

Store as `config/theme_templates.yml`, loaded by `app/services/template_registry.rb`. Selector lists below are **verbatim** from `~/Downloads/Themes/ganesh/css/`. The `layout` column is a best-inference from your Step-3 rules and is **[NEED: confirm]** against internal layout names — it does not affect output.

| Template | Canvas | Inferred layout (unconfirmed) | Selectors (in order) |
|---|---|---|---|
| `theme_luxury` | a4 | Luxury | `.items-table-header`, `.tax-table-header`, `.items-table-total`, `.items-table-total-foreign` |
| `theme_one` | a4 | Modern (A) | `.title-bill-ship-to`, `.items-table-total`, `.items-table-total-foreign`, `.items-table-header`, `.tax-table-header`, `.page-footer` |
| `theme_two` | a4 | Modern (B) | `.title-bill-ship-to`, `.items-table-header`, `.items-table-total`, `.items-table-total-foreign`, `.tax-table-header`, `.page-footer` |
| `theme_three` | a4 | Adv GST / full-row | `.items-table-header`, `.tax-table-header`, `.items-table-total`, `.items-table-total-foreign`, `td[class^="items-table-tax-total-"]`, `.items-table-balance`, `.items-table-received`, `.items-table-prev-balance`, `.items-table-total-payable`, `.items-table-tax-tds`, `.items-table-curr-balance`, `.items-table-linked-cndn-record` |
| `theme_four` | **a5** | A5 short | `.items-table-header`, `.items-table-total`, `.items-table-total-foreign`, `.tax-table-header` |
| `theme_five` | a4 | Adv GST Tally / full-row | *(same 12 as `theme_three`)* |
| `theme_six` | **a5** | A5 full-row | `.items-table-header`, `.items-table-total`, `.items-table-total-foreign`, `td[class^="items-table-tax-total-"]`, `.items-table-balance`, `.items-table-received`, `.items-table-prev-balance`, `.items-table-total-payable`, `.items-table-tax-tds`, `.items-table-curr-balance`, `.items-table-linked-cndn-record`, `.tax-table-header` |
| `theme_seven` | a4 | Stylish | `#invoice-details-meta`, `.items-table-total`, `.items-table-header`, `.page-footer`, `.tax-table-header` |
| `theme_eight` | a4 | Billbook / full-row | *(same 12 as `theme_three`)* |

Notes: `theme_seven` is the only one using the ID selector `#invoice-details-meta` (→ Stylish's "invoice details meta"). `theme_one`/`theme_two` are the only ones tinting `.title-bill-ship-to` + `.page-footer` (→ Modern). Default opacity for all = `0.35`.

Registry entry shape:
```yaml
theme_luxury:
  canvas: a4
  layout: luxury           # unconfirmed label, cosmetic
  default_opacity: 0.35
  selectors:
    - ".items-table-header"
    - ".tax-table-header"
    - ".items-table-total"
    - ".items-table-total-foreign"
```

---

## 4. Data model

### `themes` table
| Column | Type | Notes |
|---|---|---|
| `id` | uuid/bigint | |
| `name` | string | human name, e.g. "Ganesh Ji" |
| `slug` | string | `.overlay_name` + folder + CSS path. Slugified: lowercase, non-alnum→`_`, collapse repeats, strip ends. Unique. |
| `prompt` | text | user's theme prompt |
| `status` | string enum | `draft` → `generating` → `ready` → `published`; plus `failed` |
| `artwork_opacity` | decimal | theme-level default, seed `0.35` |
| `tint_hex` | string | theme-level default tint (computed after generation) |
| `blend_overrides` | jsonb | per-template overrides, default `{}` (see §4.1) |
| `error_message` | text | populated on `failed` |
| timestamps | | |

Images: two ActiveStorage attachments, `a4_image` and `a5_image`.

### 4.1 `blend_overrides` JSONB shape
Only stores deltas from defaults; empty means "use registry + theme defaults". Keyed by template id:
```json
{
  "theme_one": {
    "artwork_opacity": 0.30,
    "tint_hex": "#FBEFD8",
    "strips": {
      ".page-footer":        { "enabled": false },
      ".items-table-header": { "enabled": true, "tint_hex": "#F3E4C7", "alpha": 0.8 }
    }
  }
}
```
**Effective value resolution** (assembler reads in this order): strip-level override → template-level override → theme default → registry default.

---

## 5. Tint sampling heuristic

Goal: a near-white tint of the artwork's own hue (reference values: `#FEF5E9` warm cream, `#FFF5DA` warm sand — both ~93–95% lightness, low saturation).

Algorithm (`app/services/tint_sampler_service.rb`, uses libvips):
1. Downscale the A4 image; compute the **average color** (or dominant via a coarse histogram).
2. Convert to HSL.
3. Output `HSL(hue, min(saturation, 0.20), 0.95)` → convert back to hex, uppercase.
4. Validation targets: a warm-orange artwork should land near `#FEF5E9`/`#FFF5DA`. Don't over-saturate — the band must read as "barely tinted white."

This becomes the theme-level `tint_hex` default after generation; the user can override per template via the blend editor.

---

## 6. Image generation (F2)

### 6.1 Guardrail prompt (Layer-1 readability). Store editable in `config/guardrail_prompt.yml`.
Starter template — wrap the user's prompt:
```
Create a decorative background artwork for a business invoice on the theme: "{{USER_PROMPT}}".

HARD RULES (readability):
- Keep the CENTER and the full VERTICAL MIDDLE COLUMN of the image light, calm, near-empty, and low-contrast — invoice text sits there.
- Push all detail, color, and motifs to the EDGES and CORNERS only.
- NO text, letters, numbers, or logos anywhere in the image.
- Soft / pastel / muted palette. Light textures. One single strong theme idea.
- Spacious composition. No heavy gradients, no loud colors, no clutter.
- Must remain legible when placed at 30–40% opacity behind black text.

ORIENTATION: {{ORIENTATION}}.
```
`{{ORIENTATION}}` = `"portrait, taller than wide"` for A4, `"landscape, wider than tall"` for A5.

### 6.2 OpenRouter call
- Endpoint: `POST {{OPENROUTER_BASE_URL}}/chat/completions` (base `https://openrouter.ai/api/v1`).
- Model: env `OPENROUTER_MODEL`, default an image-output model (e.g. `google/gemini-2.5-flash-image-preview`). **[NEED: confirm exact model id + that it returns images.]**
- Request must request image output (per OpenRouter image-gen: set `"modalities": ["image","text"]`). The generated image comes back on the assistant message (base64 data URL). **[verify exact response field against current OpenRouter docs — likely `choices[0].message.images[]`].**
- Call **twice** (portrait, landscape) — two separate generations, not a resize of one.
- Wrap behind `ImageEngine` interface (`app/services/image_engine/base.rb` + `openrouter.rb`) so the provider swaps via config.

### 6.3 Post-process (libvips)
- Decode the returned image → smart-fit/crop to **exact** px: A4 `600×848`, A5 `1024×724` (dimensions in config). → attach as `a4_image` / `a5_image` (JPEG).

### 6.4 Async
Generation is ~10–30s × 2 → **do it in an ActiveJob** (`GenerateThemeImagesJob`). The `generate` endpoint returns `202` immediately with `status: "generating"`; the frontend polls `GET /themes/:id`. On success → compute tint (§5), set `status: ready`. On error → `status: failed`, set `error_message`.

---

## 7. CSS assembler + packager (F3)

`app/services/css_assembler_service.rb`:
- Input: a `Theme` + a template id. Resolve canvas, selectors, opacity, and tint per §4.1.
- **Strip grouping:** selectors with default settings (enabled, no custom tint/alpha) are joined into the single shared rule from §2.1. A strip with a custom `tint_hex`/`alpha` is emitted as its *own* rule using `rgba(tint, alpha)` + `mix-blend-mode: multiply !important;`. Disabled strips are omitted. (This is what powers the blend editor's per-part slider.)
- Output: the normalized CSS string for that template.

`app/services/theme_packager_service.rb`:
- Builds the full folder in a temp dir: write `.overlay_name` (slug, no newline), copy the two images into `images/`, render all 9 `css/<template>/latest.css`. Zip on demand.

Build/verify **F3 before F2** — drop any existing image in and confirm the 9 files match `ganesh/` normalized.

---

## 8. API contract (F6)

JSON, under `/api/`. Shapes the frontend (F7–F10) builds against.

| Method | Path | Body | Returns |
|---|---|---|---|
| `POST` | `/themes` | `{ name, prompt }` | `201` theme (status `draft`) |
| `POST` | `/themes/:id/generate` | — | `202 { id, status:"generating" }` |
| `GET` | `/themes/:id` | — | theme (see below) |
| `GET` | `/themes/:id/preview` | — | `{ templates: [ { template_id, canvas, css, image_url, base_invoice_html } ] }` |
| `PATCH` | `/themes/:id/blend` | `{ template_id, artwork_opacity?, tint_hex?, strips? }` | `{ template_id, css }` (recomputed) |
| `POST` | `/themes/:id/regenerate` | `{ prompt? }` | `202 { status:"generating" }` |
| `POST` | `/themes/:id/publish` | — | `{ status:"published" }` or error |
| `GET` | `/themes/:id/download` | — | `application/zip` of the folder (manual verification before publish API exists) |

Theme response object:
```json
{
  "id": "…", "name": "Ganesh Ji", "slug": "ganesh",
  "prompt": "…", "status": "ready",
  "tint_hex": "#FEF5E9", "artwork_opacity": 0.35,
  "a4_image_url": "…", "a5_image_url": "…",
  "blend_overrides": { },
  "templates": ["theme_luxury","theme_one", "…"]
}
```
`base_invoice_html` in `/preview` is **[NEED]** (§10) — stub with sample invoice HTML per format until the real markup is provided.

---

## 9. Config / env (never hardcode secrets)

```
DATABASE_URL=
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=google/gemini-2.5-flash-image-preview   # [NEED: confirm]
A4_WIDTH=600  A4_HEIGHT=848
A5_WIDTH=1024 A5_HEIGHT=724
DEFAULT_OPACITY=0.35
PUBLISH_API_URL=          # [NEED]
PUBLISH_API_TOKEN=        # [NEED]
```

---

## 10. Open [NEED]s (external — stub and proceed)

1. **Base invoice HTML/CSS per format** — for `/preview` + frontend grid. Use sample HTML per template until provided.
2. **OpenRouter model id + response field** — confirm which model returns images and the exact JSON path.
3. **myBillbook publish API** — URL, payload shape, auth for F5.
4. **Template→layout name mapping** — confirm the `layout` labels in §3 against internal names.

---

## 11. Verification

- **Golden test (F3, the important one):** for a fixed image + `tint_hex=#FEF5E9` + `opacity=0.35` + `slug=ganesh`, assemble all 9 templates and assert each **normalized** string equals the **normalized** reference at `~/Downloads/Themes/ganesh/css/<template>/latest.css`. Normalization = LF endings, strip trailing whitespace, force `mix-blend-mode: multiply !important;`, ensure the `transform` line present. Selectors, order, tint, opacity, and the `flash-themes/ganesh/images/<canvas>.jpeg` path must all match.
- **Tint (§5):** feed the ganesh `a4.jpeg` → assert output is a light warm tint near `#FEF5E9` (e.g. lightness ≥ 0.9, saturation ≤ 0.2).
- **Generation (F2):** run once → two images at exact px with a visibly calm center.
- **End-to-end:** `POST /themes` → `generate` → poll `ready` → `download` → unzip → folder shape matches a real theme folder.
- **Blend (PATCH):** disable `.page-footer` on `theme_one` → that selector disappears from the returned CSS; set a strip `alpha:0.8` → it emits its own `rgba(...)` rule.
- **Publish (F5):** point `PUBLISH_API_URL` at a mock → confirm the exact folder payload is POSTed and status flips to `published`.
```
