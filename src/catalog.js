'use strict';

/**
 * src/catalog.js — turning raw products.json into a readable picture of the shop.
 */

const DAY_MS = 86400000;

// Products that aren't really merchandise and would skew the mix.
const NOISE_TYPE = /package[_ ]?protection|^returns?$|gift ?card|^default$|^shipping/i;

const toPrice = (value) => {
  if (value == null) return null;
  const number = parseFloat(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(number) ? number : null;
};

/** "Womens > Apparel > Leggings > full_length" -> "Leggings › Full length" */
function tidyType(raw) {
  const parts = String(raw || '')
    .split(/\s*>\s*|\s*\/\s*|\s*\|\s*/)
    .map((part) => part.replace(/_/g, ' ').trim())
    .filter(Boolean);

  return parts
    .slice(-2)
    .join(' › ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .slice(0, 46);
}

function topEntries(map, limit) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

/** Month keys for the last 12 months, oldest first. */
function lastTwelveMonths() {
  const months = [];
  const now = new Date();
  for (let back = 11; back >= 0; back--) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    months.push(date.toISOString().slice(0, 7));
  }
  return months;
}

function buildCatalog(products, meta) {
  const publishedCount = meta && Number.isFinite(meta.published_products_count) ? meta.published_products_count : null;
  const collectionCount = meta && Number.isFinite(meta.published_collections_count) ? meta.published_collections_count : null;

  const catalog = {
    sampledCount: products.length,
    publishedCount: publishedCount ?? products.length,
    collectionCount,
    isSampled: publishedCount != null ? products.length < publishedCount : !!products.truncated,
    currency: (meta && meta.currency) || null,
    types: [],
    otherTypes: 0,
    tags: [],
    vendors: [],
    options: [],
    price: { min: null, max: null, median: null, average: null },
    newest: [],
    launches: { months: lastTwelveMonths().map((month) => ({ month, count: 0 })), last30: 0, last90: 0 },
    latestProductAt: null,
    soldOutShare: null,
  };

  if (!products.length) return catalog;

  const typeCounts = new Map();
  const tagCounts = new Map();
  const vendorCounts = new Map();
  const optionCounts = new Map();
  const prices = [];
  const launchCounts = new Map();
  const now = Date.now();

  let variants = 0;
  let soldOutVariants = 0;
  let last30 = 0;
  let last90 = 0;
  let latest = 0;

  for (const product of products) {
    const rawType = String(product.product_type || '').trim();
    if (rawType && !NOISE_TYPE.test(rawType)) {
      const type = tidyType(rawType);
      if (type) typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    }

    for (const tag of product.tags || []) {
      const clean = String(tag).trim();
      if (!clean || clean.length > 40) continue;
      if (/^[a-z0-9_-]+::/i.test(clean) || /[=>]/.test(clean)) continue; // internal / metafield tags
      tagCounts.set(clean, (tagCounts.get(clean) || 0) + 1);
    }

    const vendor = String(product.vendor || '').trim();
    if (vendor) vendorCounts.set(vendor, (vendorCounts.get(vendor) || 0) + 1);

    for (const option of product.options || []) {
      const name = typeof option === 'string' ? option : option && option.name;
      if (name) optionCounts.set(name, (optionCounts.get(name) || 0) + 1);
    }

    for (const variant of product.variants || []) {
      variants += 1;
      if (variant.available === false) soldOutVariants += 1;
      const price = toPrice(variant.price);
      if (price != null && price >= 1) prices.push(price); // ignore protection/gift-card noise
    }

    const publishedAt = Date.parse(product.published_at || product.created_at || '');
    if (!Number.isFinite(publishedAt)) continue;

    if (publishedAt > latest) latest = publishedAt;
    const age = now - publishedAt;
    if (age <= 30 * DAY_MS) last30 += 1;
    if (age <= 90 * DAY_MS) last90 += 1;

    const month = new Date(publishedAt).toISOString().slice(0, 7);
    launchCounts.set(month, (launchCounts.get(month) || 0) + 1);
  }

  if (prices.length) {
    prices.sort((a, b) => a - b);
    catalog.price.min = prices[0];
    catalog.price.max = prices[prices.length - 1];
    catalog.price.median = prices[Math.floor(prices.length / 2)];
    catalog.price.average = Math.round((prices.reduce((sum, price) => sum + price, 0) / prices.length) * 100) / 100;
  }

  const allTypes = [...typeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      count,
      share: Math.round((count / products.length) * 100),
    }));

  catalog.types = allTypes.slice(0, 8);
  catalog.otherTypes = Math.max(0, allTypes.length - catalog.types.length);
  catalog.tags = topEntries(tagCounts, 20);
  catalog.vendors = topEntries(vendorCounts, 8);
  catalog.options = topEntries(optionCounts, 6);
  catalog.launches.months = catalog.launches.months.map((entry) => ({
    ...entry,
    count: launchCounts.get(entry.month) || 0,
  }));
  catalog.launches.last30 = last30;
  catalog.launches.last90 = last90;
  catalog.latestProductAt = latest ? new Date(latest).toISOString() : null;
  catalog.soldOutShare = variants ? Math.round((soldOutVariants / variants) * 100) : null;

  catalog.newest = products
    .filter((product) => product.title)
    .sort((a, b) => Date.parse(b.published_at || b.created_at || 0) - Date.parse(a.published_at || a.created_at || 0))
    .slice(0, 8)
    .map((product) => {
      const variant = (product.variants && product.variants[0]) || {};
      const image = (product.images && product.images[0] && (product.images[0].src || product.images[0])) || (product.image && product.image.src) || null;
      return {
        title: product.title,
        type: NOISE_TYPE.test(product.product_type || '') ? '' : tidyType(product.product_type),
        vendor: product.vendor || '',
        image,
        price: toPrice(variant.price),
        available: (product.variants || []).some((item) => item.available !== false),
        publishedAt: product.published_at || product.created_at || null,
      };
    });

  return catalog;
}

module.exports = { buildCatalog, tidyType, DAY_MS };
