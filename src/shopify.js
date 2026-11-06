'use strict';

/**
 * src/shopify.js — talking to a Shopify storefront.
 * Public endpoints used: /  (HTML), /meta.json, /products.json, /blogs/<handle>.atom
 */

const { request, requestJson, UserError } = require('./net');
const { stripTags, unescapeHtml } = require('./html');

const PRODUCT_PAGE_SIZE = 250;
const MAX_PRODUCT_PAGES = 4; // up to 1,000 newest products

/**
 * Load the homepage. Stores often behave differently on apex vs www, and some
 * bounce crawlers to a bare checkout shell, so we try every variant and keep
 * the richest response.
 */
async function loadStorefront(url) {
  const bare = url.hostname.replace(/^www\./i, '');
  const candidates = [...new Set([`https://${url.hostname}/`, `https://www.${bare}/`, `https://${bare}/`])];

  const attempts = await Promise.all(candidates.map((candidate) => request(candidate, { timeout: 20000 })));
  const rank = (attempt) => (!attempt.ok ? -1 : /\/password/i.test(attempt.url) ? 1 : attempt.body.length);
  const ranked = attempts.slice().sort((a, b) => rank(b) - rank(a));

  const notes = [];
  let page = ranked[0];

  if (!page || !page.ok) {
    const fallback = await request(`http://${bare}/`, { timeout: 15000 });
    if (fallback.ok) {
      page = fallback;
      notes.push('This store does not answer over HTTPS — analysis was done over plain HTTP.');
    }
  }

  if (!page || !page.ok) {
    if (!page || page.status === 0) throw new UserError(`Could not reach ${bare} — ${page ? page.error : 'network error'}.`);
    throw new UserError(`${bare} responded with HTTP ${page.status} and no usable page. Check the URL or try again later.`);
  }

  return {
    page,
    variants: attempts.filter((attempt) => attempt.ok && attempt.body),
    bare,
  };
}

/** /meta.json — shop name, currency, country, catalog counts, myshopify domain. */
async function loadMeta(origins) {
  const results = await Promise.all(
    origins.map((origin) => requestJson(`${origin}/meta.json`, { timeout: 12000 }))
  );

  for (const { data } of results) {
    if (data && (data.name || data.id)) return data;
  }
  return null;
}

/** /products.json — newest products, paged. Falls back across host origins. */
async function loadProducts(origins) {
  let lastStatus = null;

  for (const origin of origins) {
    const products = [];

    for (let page = 1; page <= MAX_PRODUCT_PAGES; page++) {
      const { data, response } = await requestJson(
        `${origin}/products.json?limit=${PRODUCT_PAGE_SIZE}&page=${page}`,
        { timeout: 20000 }
      );

      if (!data || !Array.isArray(data.products)) {
        lastStatus = response.status || null;
        break;
      }
      if (!data.products.length) break;

      products.push(...data.products);
      if (data.products.length < PRODUCT_PAGE_SIZE) break;
    }

    if (products.length) {
      products.truncated = products.length >= PRODUCT_PAGE_SIZE * MAX_PRODUCT_PAGES;
      products.error = null;
      return products;
    }
  }

  const empty = [];
  empty.truncated = false;
  empty.error = lastStatus;
  return empty;
}

/** Blog cadence from the Atom feed — a strong "is anyone home?" signal. */
async function loadBlog(origin, html) {
  const handles = new Set();
  for (const match of String(html).matchAll(/\/blogs\/([a-zA-Z0-9_-]+)/g)) handles.add(match[1]);
  handles.add('news');

  for (const handle of [...handles].slice(0, 4)) {
    const response = await request(`${origin}/blogs/${handle}.atom`, { accept: 'application/atom+xml' });
    if (!response.ok) continue;

    const entries = response.body.match(/<entry>[\s\S]*?<\/entry>/g) || [];
    if (!entries.length) continue;

    const posts = entries
      .map((entry) => ({
        title: stripTags((entry.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [, ''])[1]),
        publishedAt: (entry.match(/<published>([^<]+)<\/published>/) || [, ''])[1],
        url: (entry.match(/<link[^>]+href=["']([^"']+)["']/) || [, ''])[1],
      }))
      .filter((post) => post.title);

    const dates = posts.map((post) => Date.parse(post.publishedAt)).filter(Number.isFinite);

    return {
      handle,
      url: `${origin}/blogs/${handle}`,
      postsInFeed: posts.length,
      latestPostAt: dates.length ? new Date(Math.max(...dates)).toISOString() : null,
      latestTitles: posts.slice(0, 3).map((post) => unescapeHtml(post.title)),
    };
  }

  return null;
}

module.exports = { loadStorefront, loadMeta, loadProducts, loadBlog };
