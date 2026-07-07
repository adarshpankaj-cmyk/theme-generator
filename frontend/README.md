# Theme Generator — Frontend (React → Vercel)

The single-screen app for the generate → review → blend → publish loop. Build **after** the backend API exists. Root context: [`../README.md`](../README.md) · [`../context.md`](../context.md).

> **Building it? Read [`SPEC.md`](SPEC.md) first.** This README is the feature map; SPEC.md has the exact contracts — stack, screen anatomy, component tree, the iframe preview + clickable-strip technique, API integration, blend flow, and verification.

## Stack & conventions

- **React**, deployable to Vercel.
- Talks to the Rails backend over its REST API (base URL in env).
- One screen, one loop — no multi-page navigation in v1.

## The loop this screen implements

1. Type a theme → **Generate**.
2. See every invoice format rendered at once, themed.
3. If a strip's readability is off → click it → slider adjusts its tint/opacity live.
4. If the artwork is wrong → **Regenerate**.
5. **Publish**.

## Features

### F7 — Single-screen shell + generate
- Prompt box + **Generate** button. Calls backend generate (F2) → CSS assembly (F3). Show a spinner, then load the grid.

### F8 — Preview grid
- Render **all invoice formats at once** (iframe / rendered HTML per format) with the overlay applied. This "see everything in one place" grid is the core of the tool — it replaces the Figma + internal-repo round trip.

### F9 — Blend editor
- Click a strip in a preview → adjust its **tint / opacity / on-off** via slider; plus a **global artwork-opacity** slider.
- Each change PATCHes blend settings to the backend (F6) → that template's CSS re-renders live.
- Deterministic and instant: every control maps to exactly one template variable — no AI in this loop.

### F10 — Regenerate + Publish
- **Regenerate image** re-runs backend F2 (whole-image; reference-image input plugs in here as a fast-follow).
- **Publish** calls backend F5 (hands the folder to myBillbook's API).

## Depends on (backend endpoints)

- Generate theme (F2/F3), Get preview payload (F4/F6), Update blend settings (F6), Publish (F5).
- **[NEED]** base invoice HTML per format for realistic previews (see root README).

## Verification

- Load the grid after a generate → all invoice formats show the overlay.
- Drag a strip's opacity slider → that invoice's CSS updates live and text stays legible.
- Publish → backend confirms the folder was handed off and status flips to `published`.
