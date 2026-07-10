# Deployment

The app is two pieces with different hosting needs:

| Piece | Stack | Host |
|-------|-------|------|
| `frontend/` | Vite + React (static build) | **Vercel** |
| `backend/` | Rails 7.2 API + Sidekiq + Postgres + Redis + Active Storage (libvips) | **Render** |

Vercel can only host the static frontend — a Rails app with a background worker,
a database, Redis, and on-disk file storage cannot run on Vercel's serverless
platform. So the frontend goes to Vercel and the backend to Render.

Deploy the **backend first** so you have its public URL for the frontend's env var.

---

## 1. Backend → Render

Config lives in [`render.yaml`](render.yaml). It provisions:

- a **web service** running Puma **and** Sidekiq together (`backend/bin/render-start`)
  on a **1 GB persistent disk** mounted at `backend/storage`, so the image job and
  the API share the same Active Storage files;
- a managed **Postgres** database (`DATABASE_URL` injected automatically);
- a managed **Redis / Key Value** store (`REDIS_URL` injected automatically).

### Steps

1. Push this branch to GitHub.
2. In Render: **New +** → **Blueprint** → pick the repo. It reads `render.yaml`.
3. Before the first deploy finishes, set the secret env vars (marked `sync: false`)
   on the **theme-generator-api** service:

   | Var | Value |
   |-----|-------|
   | `RAILS_MASTER_KEY` | contents of your local `backend/config/master.key` (gitignored) |
   | `OPENROUTER_API_KEY` | your OpenRouter key (image generation) |
   | `FRONTEND_ORIGIN` | the Vercel URL, e.g. `https://theme-generator.vercel.app` (locks CORS) |
   | `PUBLISH_API_URL` | *optional* — only if the publish feature is used |
   | `PUBLISH_API_TOKEN` | *optional* |
   | `A4_WIDTH` / `A4_HEIGHT` / `A5_WIDTH` / `A5_HEIGHT` | *optional* — override default render dimensions |

4. `preDeployCommand` runs `rails db:prepare` (create + migrate) automatically.
5. Health check: Render polls `/up`. When green, note the URL, e.g.
   `https://theme-generator-api.onrender.com`. The API base is that **+ `/api`**.

> **Plan note:** persistent disks require a paid instance type (`starter`). Redis
> `maxmemory-policy` is set to `noeviction`, which Sidekiq requires.

---

## 2. Frontend → Vercel

Config lives in [`frontend/vercel.json`](frontend/vercel.json).

### Steps

1. In Vercel: **Add New** → **Project** → import the repo.
2. Set **Root Directory** to `frontend` (so Vercel builds only the SPA).
3. Add an environment variable (Production + Preview):

   | Var | Value |
   |-----|-------|
   | `VITE_API_BASE_URL` | `https://theme-generator-api.onrender.com/api` (backend URL + `/api`) |

   This is a **build-time** var — redeploy after changing it.
4. Deploy. Vercel runs `npm run build` and serves `dist/`.
5. Copy the resulting Vercel URL back into the backend's `FRONTEND_ORIGIN` on Render
   and redeploy the backend so CORS allows it.

### CLI alternative

```bash
cd frontend
npx vercel            # first run links/creates the project
npx vercel env add VITE_API_BASE_URL   # paste the Render API URL + /api
npx vercel --prod
```

---

## Post-deploy checklist

- [ ] `curl https://<render-api>/up` → `200`
- [ ] Open the Vercel URL, generate a theme end-to-end (exercises Sidekiq + storage)
- [ ] Confirm generated images load (verifies the persistent disk)
- [ ] Browser console shows no CORS errors (verifies `FRONTEND_ORIGIN`)
