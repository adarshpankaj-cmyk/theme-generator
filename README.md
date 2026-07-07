# Theme Generator

A single-person tool to create and publish myBillbook invoice **theme overlays** end-to-end: type a theme → it generates the artwork and auto-builds every invoice's CSS → review all invoice formats in one grid → nudge readability with a slider → publish.

See `context.md` for product background. Full feature plan: `~/.claude/plans/as-far-as-bringing-tranquil-island.md`.

## Why the overlay CSS is easy

A finished theme's CSS is near-identical boilerplate. Across 200+ reference files, the only per-theme variables are: the two artwork images, one light tint hex, an opacity (~0.35), and which invoice strips get tinted (fixed per layout). **CSS generation is deterministic templating, not AI.** The real value is the artwork, a readability guardrail, and a fast review/blend loop.

## Repo layout

| Folder | What it is | Stack |
|---|---|---|
| [`backend/`](backend/) | API: image generation, deterministic CSS assembly, theme packaging, publish handoff | Ruby on Rails (API mode) |
| [`frontend/`](frontend/) | Single-screen app: generate, preview grid, blend editor, publish | React → Vercel |

Build order: **backend first, then frontend.** Each folder has its own README with the decisions and its slice of the feature plan, so it can be worked on independently.

## Locked decisions

- **Image engine:** OpenRouter (pluggable; model swappable via config).
- **Backend:** Ruby on Rails (API), image work via libvips (`image_processing` / `ruby-vips`).
- **Frontend:** React, deployable to Vercel.
- **Hosting:** frontend → Vercel; Rails → AWS later (containerized). Storage local in dev, S3 later.
- **v1 scope:** core loop + blend editor. Reference-image input and whole-image patch-editing are fast-follows.
- **Canvases:** A4 = portrait 600×848, A5 = landscape 1024×724 → two separate generations (configurable).
- **Publish:** hand the assembled folder to myBillbook's existing API — we build the handoff, not that API.
- **Readability:** never flag problems — auto-correct or leave as-is. Guardrail at generation + in the CSS.

## A finished theme (the output contract)

```
<theme-name>/
├── .overlay_name              # one word, e.g. "ganesh"
├── images/
│   ├── a4.jpeg                # portrait 600×848
│   └── a5.jpeg                # landscape 1024×724
└── css/
    ├── theme_luxury/latest.css
    ├── theme_one/latest.css
    ├── … (9 templates total; theme_four & theme_six are the A5 ones)
    └── theme_eight/latest.css
```

Reference themes to match against: `~/Downloads/Themes/` (e.g. `ganesh/`, `maharashtra/`).

## Open dependencies ([NEED])

1. **Base invoice HTML/CSS for each of the 8 formats** — reference themes only carry the *overlay* CSS, not the underlying invoice markup. Needed to render previews. Likely in the internal repo; use sample HTML as a stand-in until provided.
2. **OpenRouter image-capable model id** — confirm which model returns images (and, for the fast-follow, accepts a reference image).
3. **myBillbook publish API** — endpoint, payload shape, auth.
4. **Confirm the 9→8 template mapping** against internal invoice layout names while extracting the registry.
