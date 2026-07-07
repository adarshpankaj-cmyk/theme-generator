# Theme Generator — Global Context

*Read-first file for this project. Deep context lives in `/Users/adarshpankaj/themes-prd/` (charter.md, product-context.md, pricing-experiment.md, data.md).*

## Mission

Build a **theme generator** that lets **one person create and publish an invoice theme end-to-end** — idea → artwork → preview on an invoice → publish to ThemeStore — with the workflow automated. Today theme creation is manual; supply of new themes is the bottleneck this tool removes.

## Company & why this exists

**myBillbook** — invoicing/GST software for Indian SMBs. Current company goal: grow **ARPU** via micro-SaaS add-ons (purchase orders, attendance/SAM, ThemeStore). ThemeStore monetizes invoice themes at **₹2 / 7-day trial → ₹149/month** (winning model from a concluded pricing experiment; legacy ₹99 and 30-day-trial cohorts still live). One payment unlocks the **entire store** — no per-theme purchase.

## What a theme is

- A **decorative overlay** (watermark-style graphic) on the invoice body — e.g., Maharashtra map silhouette, Ganesh ji illustration. It changes the look, **never the invoice data or layout**. Layout (Luxury, Modern…) and color are separate, unmonetized settings.
- Themes live in **ThemeStore** (Invoice Settings, web app) as horizontal cards; a **pack** (e.g., Hindu God) groups variants shown as pills (Laxmi ji, Krishna ji, Hanuman ji, Durga ji, Ram ji, Ganesh ji, Shiv ji).
- Reference visuals: `themes-prd/context-screenshots/`.



## Product rules the generator must respect

1. **Overlay ≠ layout** — output must sit on any invoice layout without breaking it.
2. **Free themes exist** and stay free (`FREE` badge); paid themes are additive.
3. **Store-wide unlock** — a theme is either free or part of the single paid pool; no per-theme pricing metadata needed.
4. **Auto-apply is the discovery channel** — festival themes need release timing tied to the festival calendar; state themes need a geography tag.
5. Discovery surfaces consuming themes: ThemeStore panel, and the in-invoice **swipe-to-try stack** + **5-second teaser** (Strategy 3.0) — new themes should feed all of them.


## Working rules (inherited from charter)

- Lead with the recommendation; direct, concise, no filler.
- Never fabricate data — flag gaps as `[NEED: data from X]`.
- Break problems down and verify step-by-step; don't one-shot.
