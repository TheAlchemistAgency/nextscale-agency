# Sharing NEXTSCALE AGENCY with your team

There are two ways to put this in front of your team. Pick one.

| | Live workspace preview | Deployed site (recommended) |
| --- | --- | --- |
| URL | `https://3000-i6byq9c8sury1m7ixufur.e2b.app` | your own, e.g. `https://nextscale.onrender.com` |
| Works when | only while this Arena workspace is running | 24/7 |
| Password | none (add one at deploy) | optional, via `TEAM_PASSWORD` |
| Saved reports | kept in this workspace | kept on the host (with a disk) |
| Good for | showing someone right now | **your team's day-to-day use** |

---

## Option A — Share the live preview right now (30 seconds)

Send your team this link:

```
https://3000-i6byq9c8sury1m7ixufur.e2b.app
```

It serves the full app: scanner, reports, PDF export. The catch is that the URL only
responds while this workspace is awake — it sleeps when nobody is using it, so treat it
as a demo link, not a permanent home.

---

## Option B — Deploy to a permanent URL (≈5 minutes, free)

The repo is already packaged for hosting. Everything needed is in the project root:
`Dockerfile`, `render.yaml`, `railway.json`, `fly.toml`, `Procfile`, `.env.example`.

### 1. Push the code to GitHub

```bash
cd nextscale
git init
git add .
git commit -m "NEXTSCALE AGENCY store intelligence"
git branch -M main
git remote add origin https://github.com/<you>/nextscale-agency.git
git push -u origin main
```

`.gitignore` already excludes `node_modules` and `data/*.json`, so no saved customer
reports end up in the repo.

### 2. Render (easiest, has a free tier)

1. Go to [render.com](https://render.com) → **New → Blueprint**.
2. Pick the repo. Render reads `render.yaml` and configures everything.
3. When asked for `TEAM_PASSWORD`, type the password you want to share with the team.
4. **Apply** — you get `https://nextscale-agency.onrender.com` in a couple of minutes.

Notes:
- The free plan has no persistent disk. Reports survive restarts on the `starter` plan
  (which is why `render.yaml` asks for one); on free they reset when the service sleeps.
- If you'd rather not use a blueprint: **New → Web Service**, build `npm install`,
  start `node server.js`, then add the `TEAM_PASSWORD` env var.

### 3. Railway (also one click)

1. [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**.
2. Railway auto-detects Node, uses `railway.json`, and gives you a public domain under
   **Settings → Networking → Generate Domain**.
3. Add `TEAM_PASSWORD` under **Variables**.
4. For durable reports, add a Volume mounted at `/data` and set `DATA_DIR=/data`.

### 4. Fly.io (if you want it fast everywhere)

```bash
fly launch --no-deploy --copy-config
fly volumes create nextscale_data --size 1
fly secrets set TEAM_PASSWORD="your-team-password"
fly deploy
```

`fly.toml` already wires the health check, the volume at `/data` and `DATA_DIR`.

### 5. Any Docker host

```bash
docker build -t nextscale-agency .
docker run -p 3000:3000 \
  -e TEAM_PASSWORD="your-team-password" \
  -v nextscale-data:/app/data \
  nextscale-agency
```

---

## The team password (important)

The password is currently **`LET'S SCALE TO MILLONS`** — it lives in `.env` (gitignored)
for local use, and must be set as an env var on whatever host you deploy to.

Set `TEAM_PASSWORD` on the host and the app locks itself:

- Visiting the site shows a **Team access** login page.
- A correct password sets a signed, httpOnly cookie for 30 days, so each teammate only
  types it once per browser.
- Links with `?k=<password>` sign someone in instantly (convenient for onboarding, though
  the password then appears in chat history — prefer the login form).
- API calls from scripts can send `x-team-key: <password>`.
- Leave `TEAM_PASSWORD` unset and the app is fully public. Don't do that on a real domain.

Quick one-click link to send the team (URL-encoded), then clean up any `%20`:

```
https://your-domain/?k=LET'S%20SCALE%20TO%20MILLONS
```

It signs them in and redirects to the clean URL. Note the password is visible in the link,
so prefer the login form for anything long-lived.

Also set `SESSION_SECRET` to any long random string on a real deployment (Render's
blueprint generates one automatically).

---

## Where the data lives

Reports are stored as JSON in `DATA_DIR` (default `./data`, last 200 kept).

| Host | Durable setup |
| --- | --- |
| Render | `DATA_DIR=/var/data` + a 1 GB disk at `/var/data` |
| Railway | Volume at `/data` + `DATA_DIR=/data` |
| Fly.io | Volume `nextscale_data` at `/data` + `DATA_DIR=/data` |
| Docker | `-v nextscale-data:/app/data` |

Without a volume nothing breaks — reports simply reset when the container restarts.

---

## Health & operations

- `GET /api/health` → `{"ok":true,"uptime":…}` — point your host's health check here
  (already configured in `render.yaml`, `railway.json` and `fly.toml`).
- Logs print the port, whether the team gate is on, and where reports are stored.
- Diagnostics for the analyzer itself: `npm run check -- store.com` (add `VERBOSE=1`).

---

## A note on scale and etiquette

Each scan makes several outbound requests to a third-party storefront. For a small team
that's fine. If this grows into heavy daily use, add a cache (same URL within ~10 minutes
returns the stored report) and a per-IP rate limit — both are small additions to
`server.js`.
