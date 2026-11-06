# NEXTSCALE AGENCY — Shopify Store Intelligence

Paste a Shopify URL, get a client-ready dashboard in ~20 seconds:

- **What they sell** — product count, category mix with share of catalog, price band + median, variants, tags, vendors, newest products with images
- **Is the store alive?** — a 0–100 activity score with a plain-English verdict and a per-signal breakdown
- **Every social profile** — Instagram, TikTok, Facebook, X, YouTube, Pinterest, LinkedIn, Snapchat, Threads, Discord, Telegram, WhatsApp
- **Launch cadence chart** — products published per month for the last 12 months
- **Tech & marketing stack** — theme, market, currency, detected apps and pixels
- **The pitch, pre-written** — an auto-generated “what NEXTSCALE would do with this store” section

Every report lives at a shareable link (`/r/<id>`) and prints cleanly to PDF.

---

## Share it with your team

- **Right now:** `https://3000-i6byq9c8sury1m7ixufur.e2b.app` (live while this workspace runs)
- **Permanently:** deploy the repo — see **[DEPLOY.md](DEPLOY.md)** for Render / Railway / Fly / Docker, including the shared `TEAM_PASSWORD` login.

```bash
npm start    # reads .env — the team password is already set there
TEAM_PASSWORD="something-else" npm start   # override for one run
```

---

## Run

```bash
cd nextscale
npm install     # express is the only dependency
npm start       # http://localhost:3000
```

Node 18+ (uses the built-in `fetch`). Smoke-test the analyzer without the UI:

```bash
npm run check -- allbirds.com gymshark.com
VERBOSE=1 npm run check -- gymshark.com
```

---

## Architecture

```
nextscale/
├── server.js                  Express wiring only: routes, image proxy, errors
├── src/
│   ├── net.js                 HTTP: timeouts, UA, redirects, user-facing errors
│   ├── html.js                Page parsing: theme, Shopify proof, socials, contacts, apps
│   ├── shopify.js             Storefront endpoints: /, /meta.json, /products.json, blog atom
│   ├── catalog.js             products.json → category mix, pricing, launch history
│   ├── activity.js            The 0–100 activity score
│   ├── analyze.js             Orchestrator → one serialisable report object
│   ├── store.js               Report persistence (JSON file, last 200)
│   └── render/
│       ├── components.js      HTML/SVG primitives: gauge, chart, meters, chips
│       ├── advice.js          Recommendations engine (the agency's point of view)
│       └── report.js          The report dashboard
├── public/
│   ├── index.html             Landing page
│   ├── styles.css             Design system (+ print stylesheet)
│   └── app.js                 Scanner, progress states, live feed
├── scripts/check.js           CLI smoke test
└── data/reports.json          Saved reports
```

Each module is independently testable, and the analyzer has no idea an Express server exists.

---

## How the analysis works

All public storefront signals — no API keys, no database, no scraping vendor.

| Signal | Source |
| --- | --- |
| Shop name, description, currency, country, catalog counts, myshopify domain | `/meta.json` (tries every host variant) |
| Catalog, prices, variants, tags, vendors, publish dates | `/products.json` — up to 4 × 250 newest products |
| Blog cadence + headlines | `/blogs/<handle>.atom` |
| Theme, socials, emails, app fingerprints, password/bot walls | Storefront HTML (apex + `www`, plus JSON-LD `sameAs`) |

### Activity score (0–100)

| Component | Max | Logic |
| --- | --- | --- |
| Product freshness | 32 | age of newest product (≤7 days = full marks) |
| Launch velocity | 24 | products published in the last 30 days |
| Content cadence | 14 | age of the newest blog post |
| Social footprint | 15 | number and weight of linked networks |
| Storefront health | 15 | HTTP status, password wall, bot wall |

Bands: **Highly active** 78+, **Active** 58+, **Moderately active** 38+, **Low activity** 18+, **Dormant** below.

### Honest about limits

Some stores (Lululemon, for example) block crawlers or hide `products.json`. The report never invents numbers: it shows a **Data caveats** card listing what could not be read, and if the storefront is unreachable it returns a clear error instead of a fake report.

---

## API

```bash
# run a scan
curl -X POST localhost:3000/api/analyze \
  -H 'content-type: application/json' \
  -d '{"url":"allbirds.com"}'

curl localhost:3000/api/report/<id>   # stored report JSON
curl localhost:3000/api/reports       # 8 most recent scans (landing-page feed)
curl localhost:3000/api/health
```

## Production notes

- `data/reports.json` is a file store — move to SQLite/Postgres for real traffic, and add expiry.
- `/api/image` proxies store logos and product shots; it refuses private hosts and raw IPs so it can't be used to probe a network.
- Only public endpoints a normal browser can reach are used. If you scale this up, keep it polite: cache scans, respect robots directives and store terms.
