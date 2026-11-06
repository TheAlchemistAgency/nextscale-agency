'use strict';

/**
 * src/analyze.js — the orchestrator.
 * One public function: analyzeStore(input) -> a full, serialisable report object.
 */

const { toUrl, UserError } = require('./net');
const { loadStorefront, loadMeta, loadProducts, loadBlog } = require('./shopify');
const { buildCatalog } = require('./catalog');
const { scoreActivity } = require('./activity');
const html = require('./html');

const absolute = (href, base) => {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
};

const titleCase = (value) =>
  String(value || '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();

async function analyzeStore(input) {
  const startedAt = Date.now();
  const url = toUrl(input);
  const warnings = [];

  /* 1 — the homepage ------------------------------------------------ */
  const { page, variants, bare } = await loadStorefront(url);
  const origins = [...new Set([new URL(page.url).origin, `https://${url.hostname}`, `https://www.${bare}`, `https://${bare}`])];
  const origin = origins[0];
  const domain = new URL(origin).hostname.replace(/^www\./i, '');
  const pages = variants.map((variant) => variant.body);

  /* 2 — Shopify data in parallel ------------------------------------ */
  const [meta, products, blog] = await Promise.all([loadMeta(origins), loadProducts(origins), loadBlog(origin, page.body)]);

  /* 3 — read what the HTML tells us --------------------------------- */
  const basics = html.readPageBasics(page.body);
  const signals = html.readShopifySignals(page.body, page.url);
  const catalog = buildCatalog(products, meta);
  const socials = html.mergeSocials(pages.map((body) => html.readSocials(body)));
  const contacts = html.readContacts(pages.join('\n'));
  const apps = [...new Set(pages.flatMap((body) => html.readApps(body)))];

  const storefront = {
    status: page.status,
    finalUrl: page.url,
    responseMs: page.ms,
    title: basics.title,
    description: basics.description,
    blockedByBotWall: html.isBotWall(page.status, page.body, basics.title),
    passwordProtected: signals.passwordProtected,
    hasCart: signals.hasCart,
  };

  const shopify = {
    isShopify: signals.isShopify || !!meta || products.length > 0 || /\.myshopify\.com$/i.test(domain),
    evidence: signals.evidence.length
      ? signals.evidence
      : meta
        ? ['Shopify meta.json endpoint reachable']
        : products.length
          ? ['Shopify products.json endpoint reachable']
          : [],
    myshopifyDomain: (meta && meta.myshopify_domain) || null,
    shopId: (meta && meta.id) || null,
    themeName: signals.themeName,
    themeId: signals.themeId,
    currency: (meta && meta.currency) || signals.currency || catalog.currency || null,
    country: (meta && meta.country) || signals.country || null,
    city: (meta && meta.city) || null,
    province: (meta && meta.province) || null,
    locale: signals.locale,
    shopPay: !!(meta && meta.shopify_pay_enabled_card_brands && meta.shopify_pay_enabled_card_brands.length),
    shipsToCount: meta && Array.isArray(meta.ships_to_countries) ? meta.ships_to_countries.length : null,
  };
  catalog.currency = catalog.currency || shopify.currency;

  /* 4 — caveats: never invent what we could not read ---------------- */
  if (storefront.blockedByBotWall) {
    warnings.push(
      `The storefront blocks crawlers (bot protection${page.status ? `, HTTP ${page.status}` : ''}). Everything below is what public endpoints still exposed — some sections may be empty. Try again in a few minutes.`
    );
  }
  if (!products.length) {
    warnings.push(
      `The catalog endpoint (products.json) was not readable${products.error ? ` (HTTP ${products.error})` : ''}. The theme may block it, or the store may be password protected, so product detail is limited.`
    );
  } else if (catalog.isSampled) {
    warnings.push(
      `Catalog figures come from the ${catalog.sampledCount.toLocaleString('en-US')} newest products out of about ${catalog.publishedCount.toLocaleString('en-US')} published, so category mix, pricing and launch counts reflect that sample.`
    );
  }
  if (!meta) warnings.push('Shop metadata (meta.json) was unavailable — shop details were inferred from the page source.');
  if (!shopify.isShopify) warnings.push('No Shopify signatures were found. This may not be a Shopify store, so treat the numbers as generic page analysis.');
  if (storefront.passwordProtected) warnings.push('The storefront is password protected — likely pre-launch or invite-only, which is why product and social data may be missing.');

  /* 5 — score it ---------------------------------------------------- */
  const activity = scoreActivity({ catalog, socials, blog, storefront });

  /* 6 — name it ------------------------------------------------------ */
  const nameFromTitle = (basics.title || '').split(/[|\-–—]/)[0].trim();
  const titleLooksBlocked = /access denied|just a moment|attention required|are you a robot|request blocked|^error/i.test(nameFromTitle);
  const shopName =
    (meta && meta.name) ||
    basics.siteName ||
    (titleLooksBlocked ? '' : nameFromTitle) ||
    titleCase(bare.split('.')[0]);

  return {
    id: null,
    analyzedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    input,
    url: page.url,
    origin,
    domain,
    shopName,
    description: (meta && meta.description) || basics.description || '',
    favicon: basics.favicon ? absolute(basics.favicon, origin) : null,
    ogImage: basics.ogImage ? absolute(basics.ogImage, origin) : null,
    shopify,
    storefront,
    catalog,
    socials,
    contacts,
    apps,
    blog,
    activity,
    warnings: [...new Set(warnings)],
  };
}

module.exports = { analyzeStore, UserError };
