'use strict';

/**
 * src/limits.js — light protection for a publicly reachable deployment.
 *
 *  - scanResults: identical URLs within CACHE_TTL reuse a recent report, so a
 *    team hammering the same prospect store doesn't re-crawl the whole catalog.
 *  - rateLimit: a simple fixed-window counter per IP, enough to stop a runaway
 *    script or a curious visitor from hammering third-party storefronts.
 *
 * No dependencies, no external store — processes are single-instance by design.
 */

const WINDOW_MS = Number(process.env.RATE_WINDOW_MS || 60000);
const MAX_REQUESTS = Number(process.env.RATE_MAX || 60); // scans per window per IP
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 10 * 60 * 1000); // 10 minutes

/* ---------------------------- scan cache ---------------------------- */

const cache = new Map(); // normalised url -> { reportId, report, at }

const key = (url) => String(url || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '').replace(/^www\./, '');

function cacheGet(url) {
  const entry = cache.get(key(url));
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(key(url));
    return null;
  }
  return entry.report;
}

function cacheSet(url, report) {
  if (cache.size > 500) {
    // drop the oldest half rather than growing forever
    const sorted = [...cache.entries()].sort((a, b) => a[1].at - b[1].at);
    sorted.slice(0, 250).forEach(([oldKey]) => cache.delete(oldKey));
  }
  cache.set(key(url), { report, at: Date.now() });
}

function cacheSize() {
  return cache.size;
}

/* ---------------------------- rate limit ---------------------------- */

const hits = new Map(); // ip -> { count, resetAt }

function rateLimit(req, res, next) {
  const ip =
    (req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown';

  const now = Date.now();
  let bucket = hits.get(ip);

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    hits.set(ip, bucket);
  }

  bucket.count += 1;

  // keep the map from leaking memory on a busy host
  if (hits.size > 5000) {
    for (const [ipKey, value] of hits) if (now > value.resetAt) hits.delete(ipKey);
  }

  if (bucket.count > MAX_REQUESTS) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    res.set('retry-after', String(retryAfter));
    return res.status(429).json({
      error: `Too many scans from this network. Try again in ${retryAfter} seconds.`,
    });
  }

  next();
}

module.exports = { cacheGet, cacheSet, cacheSize, rateLimit, CACHE_TTL_MS, MAX_REQUESTS };
