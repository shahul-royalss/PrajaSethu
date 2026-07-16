# Deploying Praja Setu (going live)

Praja Setu is two long-running services — the **NestJS API** and the **Next.js web app** (with a
SQLite database). The web app proxies `/api/*` to the API over the private network, so the **browser
only ever talks to one public URL** (the web app) — no CORS, one surface to expose.

Pick whichever path fits. All of them produce a public HTTPS site.

---

## Option A — Docker on any server/VPS (most self-contained)

Works from a plain clone or the git bundle; no GitHub or platform account needed.

```bash
# on a server with Docker installed
JWT_SECRET=$(openssl rand -hex 32) \
  docker compose -f docker-compose.prod.yml up -d --build
```

Open `http://<server-ip>:3000`. Put it behind Caddy/Nginx (or a cloud load balancer) for a domain + TLS.
Only port 3000 needs to be public; the API stays on the internal compose network. The SQLite db
persists in the `apidata` volume (remove the volume for an ephemeral demo that re-seeds each deploy).

---

## Option B — Render (managed, free tier, HTTPS out of the box)

1. Get the code onto a GitHub repo you control (see *Getting the code up* below).
2. Render dashboard → **New + → Blueprint** → select the repo → **Apply**. It reads
   [`render.yaml`](render.yaml) and creates both services **plus a free Postgres** — the API applies
   the schema and seeds the demo baseline automatically on first boot, so there is nothing to paste.
3. Open the **praja-setu-web** URL (Render may suffix the service names if they're taken globally,
   e.g. `praja-setu-web-xxxx` — `API_PROXY_TARGET` tracks the API's real URL automatically).

Caveats: Render allows one free Postgres per workspace and free databases expire after 30 days. If
the slot is taken or you need longevity, remove the `databases:` block from `render.yaml` and set
`DATABASE_URL` in the dashboard to an external Postgres (Neon / Supabase free tier).

---

## Option C — Railway / Fly.io (container PaaS)

Both build the two `Dockerfile`s. Create one service per app:
- API: build `apps/api/Dockerfile`, set `JWT_SECRET`.
- Web: build `apps/web/Dockerfile`, set `API_PROXY_TARGET` to the API service's URL (host or
  `host:port`), `NEXT_PUBLIC_API_BASE=/api`.
Expose only the web service publicly.

---

## Option D — Vercel (web) + Render/Railway (API)

- Deploy `apps/api` as a container on Render/Railway → note its public URL.
- Import `apps/web` into Vercel. Set env `API_PROXY_TARGET=<api public URL>` and
  `NEXT_PUBLIC_API_BASE=/api`. Vercel runs the Next server, which proxies `/api` to your API.

---

## Getting the code up to GitHub

The Claude session can't push (the GitHub App integration is read-only on this repo). To enable the
repo-connected options (B/C/D):

- **Grant write access:** add *Contents: write* for the Claude GitHub App on the repo, then ask the
  session to push branch `claude/build-piloted-no-errors-8je1cz`; **or**
- **Push it yourself** from the git bundle:
  ```bash
  git clone praja-setu-pilot.bundle praja-setu && cd praja-setu
  git checkout claude/build-piloted-no-errors-8je1cz
  git remote add gh https://github.com/<you>/<repo>.git
  git push gh claude/build-piloted-no-errors-8je1cz
  ```

---

## Configuration reference

| Service | Env var | Purpose | Default |
|---|---|---|---|
| api | `PORT` | Listen port | `4000` |
| api | `DATABASE_URL` | SQLite path (relative to `prisma/`) | `file:./dev.db` |
| api | `JWT_SECRET` | Token signing — **set a strong value in prod** | dev placeholder |
| api | `WEB_ORIGIN` | CORS allow-list (unused in the proxy model) | `http://localhost:3000` |
| web | `PORT` | Listen port | `3000` |
| web | `API_PROXY_TARGET` | Where Next forwards `/api/*` (URL or host[:port]) | `http://api:4000` |
| web | `NEXT_PUBLIC_API_BASE` | Client API base (build-time) | `/api` |

**Scale note (Blueprint Part J):** for real volume, switch the Prisma datasource to PostgreSQL and
front the API with the services in [`docker-compose.yml`](docker-compose.yml). Host on government
cloud / State Data Centre for data residency.
