# Deploy NEXTSCALE AGENCY — the click-by-click version

Goal: a URL like `https://nextscale-agency.onrender.com` that works forever, for the
whole team, with the password `LET'S SCALE TO MILLONS`.

Total time: about 6 minutes. You need a GitHub account and a Render account (both free).

---

## Step 0 — What you need before starting

- [ ] A GitHub account → https://github.com/signup
- [ ] A Render account → https://render.com (sign in with GitHub, no card needed for free plan)
- [ ] The project: it's already a committed git repo in `nextscale/`, or use the ZIP bundle

---

## Step 1 — Put the code on GitHub (2 minutes)

### Option A: you have git on your computer

```bash
# from inside the nextscale folder
git remote add origin https://github.com/YOURNAME/nextscale-agency.git
git push -u origin main
```

Create the empty repo first: GitHub → **+** → **New repository** → name `nextscale-agency`
→ **Private** → **Create repository** (don't add a README, your repo already has files).

### Option B: no git — upload through the browser

1. Download `nextscale-agency.zip` from this workspace.
2. Unzip it on your computer.
3. GitHub → **+** → **New repository** → `nextscale-agency` → **Private** → **Create**.
4. On the empty repo page click **"uploading an existing file"**.
5. Drag **everything inside** the unzipped folder (not the folder itself) into the browser.
6. Click **Commit changes**.

> ⚠️ Never upload `.env` — the password belongs in Render's settings, not in git.
> The `.gitignore` already blocks it, and the ZIP bundle excludes it.

---

## Step 2 — Deploy on Render (3 minutes)

1. Go to https://dashboard.render.com → **New +** → **Blueprint**.
2. **Connect** your GitHub account if asked, then pick the `nextscale-agency` repo → **Connect**.
3. Render reads `render.yaml` and shows a service named **nextscale-agency**.
4. It will ask for the env var `TEAM_PASSWORD` → paste exactly:

   ```
   LET'S SCALE TO MILLONS
   ```

   (apostrophe included, all caps, `MILLONS` as spelled)
5. Click **Apply** / **Create**.

Render now builds and starts the app (2–3 minutes). Watch the log until you see:

```
NEXTSCALE AGENCY running on http://0.0.0.0:10000
team gate: ON (password required)
```

---

## Step 3 — Test it before you share (1 minute)

1. Open the URL Render gives you (top of the service page), e.g.
   `https://nextscale-agency.onrender.com`
2. You should see the **Team access** screen.
3. Enter `LET'S SCALE TO MILLONS` → you land on the scanner.
4. Paste `allbirds.com` → **Scan store** → a report should appear in ~20 seconds.

If that works, you're done.

---

## Step 4 — Send it to the team

Copy-paste message:

> **NEXTSCALE store scanner is live:** https://nextscale-agency.onrender.com
> Password: `LET'S SCALE TO MILLONS`
> Paste any Shopify store URL → Scan store → you get the catalog, every social profile,
> and an activity score. Use **Download PDF** to send a report to a client.

Tip: each person types the password once per browser; it lasts 30 days.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Build fails with `npm ci` error | Render → Settings → Build Command → change to `npm install` |
| Site shows "Team access" even with the right password | The apostrophe auto-capitalised on a phone. Type it, or use the one-click link in the next row |
| Want a one-click login link | `https://your-url/?k=LET'S%20SCALE%20TO%20MILLONS` (signs in, then cleans the URL) |
| First visit is slow (~30 s) | Render's free plan sleeps after inactivity; the first request wakes it. Paid `starter` stays warm |
| Reports vanished after a redeploy | Free plan has no disk. Keep `starter` + the 1 GB disk from `render.yaml`, which stores reports at `/var/data` |
| Need to change the password | Render → Environment → edit `TEAM_PASSWORD` → **Save** (restarts automatically) |
| Check the app is healthy | Visit `/api/health` → `{"ok":true,"teamGate":true,...}` |

---

## What's already handled for you

- **Team password** — enforced on the deployed app; only `/login`, `/api/health`, CSS and JS stay public.
- **Report storage** — `DATA_DIR=/var/data` with a 1 GB Render disk (from `render.yaml`); last 200 reports kept.
- **Health check** — `/api/health`, wired into the blueprint.
- **Scan cache** — the same store scanned again within 10 minutes returns instantly (690 ms → 12 ms in testing).
- **Rate limit** — 60 scans per minute per IP, so nobody can hammer third-party storefronts through your link.
- **Secrets** — `.env` and `data/*.json` are gitignored; `.env.example` holds placeholders only.

Tuning knobs (any host): `RATE_MAX`, `RATE_WINDOW_MS`, `CACHE_TTL_MS`, `DATA_DIR`, `SESSION_SECRET`.
