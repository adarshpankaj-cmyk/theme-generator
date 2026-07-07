# Theme Generator — Backend (Ruby on Rails, API mode)

The API that turns a prompt into a complete, publishable theme folder. Build this **before** the frontend. Root context: [`../README.md`](../README.md) · [`../context.md`](../context.md).

> **Building it? Read [`SPEC.md`](SPEC.md) first.** This README is the feature map; SPEC.md has the exact contracts — verbatim CSS template, all 9 selector lists, data model, API JSON shapes, OpenRouter call, tint algorithm, setup, and verification. Enough to build end-to-end without guessing.

## Stack & conventions

- **Ruby on Rails** in API mode.
- **Image work:** libvips via `image_processing` / `ruby-vips` (resize to exact px, sample palette for tint).
- **Image generation:** OpenRouter, wrapped behind a pluggable `ImageEngine` interface (model id + key in config/env, never hardcoded).
- **Storage:** ActiveStorage — local disk in dev, S3 later.
- **Secrets:** OpenRouter key, publish API endpoint/auth — all via env/credentials.

## Two core concepts

**1. Template Registry (the deterministic core).** The 9 CSS templates (`theme_luxury`, `theme_one`…`theme_eight`) are stable boilerplate. Extract each once from `~/Downloads/Themes/ganesh/css/*` into config: `{ id, canvas: a4|a5, selectors: [...], default_opacity }`. `theme_four` and `theme_six` are the A5 templates; the rest are A4.

**2. Theme model.** One record carries name, prompt, images, and per-template blend settings (tint/opacity/enabled-strips) with defaults the user can override.

## Features (build in this order)

### F1 — Template Registry + Theme model *(foundation)*
- Extract the 9 templates into `config/theme_templates.yml` (or a seed): canvas, selector list, default opacity.
- `Theme` model + migration: `name`, `prompt`, `status` (draft/ready/published), `tint_hex`, `artwork_opacity`, per-template overrides (JSON). ActiveStorage for the two images.
- Files: `app/models/theme.rb`, `db/migrate/*`, `config/theme_templates.yml`, `app/services/template_registry.rb`.

### F3 — CSS Assembler + folder builder *(deterministic, no AI — build/test before F2)*
- Default **tint hex** = light shade sampled from the artwork palette (libvips); default opacity 0.35.
- Render each of the 9 templates' `latest.css` from registry + `{ image (a4/a5), tint, opacity, selectors, enabled }`.
- Assemble the exact folder shape (`.overlay_name`, `images/`, `css/<template>/latest.css`).
- Files: `app/services/css_assembler_service.rb`, `app/services/theme_packager_service.rb`, `app/views/css/latest.css.erb`.

### F2 — Image generation (OpenRouter)
- **Guardrail prompt builder** (Layer-1 readability): wrap the user's theme text in a fixed "invoice-safe" template — keep the center column light/empty/low-contrast, push decoration to edges & corners, no text in the image, soft/pastel palette, single strong idea, suitable for 40–70% opacity. Append orientation (portrait A4 / landscape A5). Store the template as editable config.
- Call OpenRouter (configurable model) **twice** — portrait + landscape.
- Post-process each to exact px (600×848 / 1024×724) with libvips smart-fit → store `images/a4.jpeg`, `images/a5.jpeg`.
- Files: `app/services/image_generation_service.rb`, `app/services/image_engine/openrouter.rb`, `app/services/prompt_builder.rb`, `config/guardrail_prompt.yml`.

### F4 — Preview render endpoint
- Return each invoice format = base invoice HTML/CSS + this theme's overlay CSS, for the frontend grid.
- **[NEED]** base invoice HTML per format (see root README); use sample HTML as a stand-in.
- Files: `app/controllers/api/previews_controller.rb`.

### F5 — Publish handoff
- Package the folder and POST to the myBillbook API (endpoint/auth in env). Mark theme `published`.
- Files: `app/services/publish_service.rb`, `app/controllers/api/publish_controller.rb`.

### F6 — API surface
- REST: create theme, generate, get preview payload, update blend settings, publish.
- Files: `app/controllers/api/themes_controller.rb`, `config/routes.rb`.

## Verification

- **F3 unit:** feed a fixed image + tint → assert all 9 `latest.css` match reference structure (selectors, blend-mode, image path) against `~/Downloads/Themes/ganesh/css/*`.
- **F2:** run a generation → two images at exact dimensions, visibly calm center.
- **End-to-end:** one API call from prompt → assembled folder on disk; diff against a real theme folder.
- **F5:** point at a mock endpoint → confirm exact folder payload POSTed and status flips to `published`.
