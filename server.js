'use strict';

/**
 * NEXTSCALE AGENCY — Shopify store intelligence
 * server.js: wiring only. All logic lives in src/.
 */

const path = require('path');

// load .env first: DATA_DIR has to be set before src/store.js is required
const { loadEnv } = require('./src/env');
loadEnv();

const express = require('express');
const { analyzeStore } = require('./src/analyze');
const auth = require('./src/auth');
const { renderReport } = require('./src/render/report');
const store = require('./src/store');
const limits = require('./src/limits');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: false, limit: '8kb' }));

// optional team gate (only active when TEAM_PASSWORD is set)
app.get('/login', auth.loginRoute);
app.post('/login', auth.loginRoute);
app.use(auth.gate);

app.use(express.static(PUBLIC_DIR, { maxAge: '1h' }));

/* ------------------------------------------------------------------ */
/* analysis                                                            */
/* ------------------------------------------------------------------ */

const inFlight = new Map(); // same URL requested twice at once = one scan

app.post('/api/analyze', limits.rateLimit, async (req, res) => {
  const input = typeof (req.body || {}).url === 'string' ? req.body.url.trim() : '';
  if (!input) return res.status(400).json({ error: 'Enter a store URL to analyze.' });

  // a scan of the same store within the cache window reuses the recent report
  const cached = limits.cacheGet(input);
  if (cached) {
    res.set('x-scan-cache', 'hit');
    return res.json(cached);
  }

  const key = input.toLowerCase();
  try {
    let job = inFlight.get(key);
    if (!job) {
      job = analyzeStore(input).then((report) => {
        store.save(report);
        limits.cacheSet(input, report);
        return report;
      });
      inFlight.set(key, job);
      job.finally(() => setTimeout(() => inFlight.delete(key), 20000)).catch(() => {});
    }
    const report = await job;
    res.json(report);
  } catch (error) {
    const status = error && error.expose ? 422 : 500;
    if (status === 500) console.error('[analyze]', error);
    res.status(status).json({ error: error && error.expose ? error.message : 'Analysis failed on our side. Try again.' });
  }
});

/* ------------------------------------------------------------------ */
/* reports                                                             */
/* ------------------------------------------------------------------ */

app.get('/api/reports', (req, res) => res.json(store.recent(8)));

app.get('/api/report/:id', (req, res) => {
  const report = store.get(req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found.' });
  res.json(report);
});

app.get('/r/:id', (req, res) => {
  const report = store.get(req.params.id);
  if (!report) return res.status(404).type('html').send(missingReportPage());
  res.type('html').send(renderReport(report));
});

/* ------------------------------------------------------------------ */
/* image proxy — store logos and product shots                         */
/* ------------------------------------------------------------------ */

const blockedHost = /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|\d+\.\d+\.\d+\.\d+$|.*\.(local|internal))/i;
const imageCache = new Map();

app.get('/api/image', async (req, res) => {
  let target;
  try {
    target = new URL(String(req.query.src || ''));
  } catch {
    return res.status(400).end();
  }
  if (!/^https?:$/.test(target.protocol) || blockedHost.test(target.hostname)) return res.status(403).end();

  const key = target.toString();
  if (imageCache.has(key)) {
    const cached = imageCache.get(key);
    return res.set('content-type', cached.type).set('cache-control', 'public, max-age=86400').send(cached.buffer);
  }

  try {
    const response = await fetch(key, {
      headers: { 'user-agent': 'Mozilla/5.0', accept: 'image/*' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return res.status(404).end();

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > 6_000_000) return res.status(413).end();

    const type = response.headers.get('content-type') || 'image/jpeg';
    if (imageCache.size > 300) imageCache.clear();
    imageCache.set(key, { buffer, type });

    res.set('content-type', type).set('cache-control', 'public, max-age=86400').send(buffer);
  } catch {
    res.status(502).end();
  }
});

/* ------------------------------------------------------------------ */
/* misc                                                               */
/* ------------------------------------------------------------------ */

app.get('/api/health', (req, res) =>
  res.json({
    ok: true,
    uptime: Math.round(process.uptime()),
    teamGate: auth.isEnabled(),
    cachedScans: limits.cacheSize(),
  })
);

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.use((error, req, res, _next) => {
  console.error('[unhandled]', error);
  res.status(500).json({ error: 'Something went wrong on our side.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`NEXTSCALE AGENCY running on http://0.0.0.0:${PORT}`);
  console.log(`team gate: ${auth.isEnabled() ? 'ON (password required)' : 'off'}`);
  console.log(`report storage: ${process.env.DATA_DIR || path.join(__dirname, 'data')}`);
});

function missingReportPage() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Report not found · NEXTSCALE AGENCY</title><link rel="stylesheet" href="/styles.css"></head>
  <body class="page-report"><main class="shell" style="padding:80px 0;text-align:center">
  <h1 style="font-size:32px">That report has expired</h1>
  <p class="muted" style="margin:12px 0 26px">Reports are kept for the most recent 200 scans. Run a fresh one — it only takes about 20 seconds.</p>
  <a class="btn btn--big" href="/">Scan a store</a></main></body></html>`;
}
