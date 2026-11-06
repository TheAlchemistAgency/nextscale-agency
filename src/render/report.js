'use strict';

/**
 * src/render/report.js — the dashboard-style store report.
 * Server-rendered, printable, no client-side JS required.
 */

const {
  escape, money, formatDate, relativeTime, shortTime, initials, gauge, launchChart, meter, chip, TONE_WORD,
} = require('./components');
const { buildAdvice } = require('./advice');

const imageUrl = (src) => (src ? `/api/image?src=${encodeURIComponent(src)}` : '');

/* ------------------------------------------------------------------ */
/* sections                                                           */
/* ------------------------------------------------------------------ */

function renderHero(report) {
  const { activity, shopify, catalog, storefront } = report;
  const currency = catalog.currency || shopify.currency || '';
  const facts = [
    shopify.isShopify && ['good', 'Shopify store'],
    shopify.themeName && ['', `Theme: ${shopify.themeName}`],
    currency && ['', `Currency: ${currency}`],
    shopify.country && ['', `Based in ${shopify.country}`],
    storefront.passwordProtected && ['warn', 'Password protected'],
    storefront.blockedByBotWall && ['warn', 'Bot-protected'],
  ].filter(Boolean);

  return `
  <section class="hero card" aria-labelledby="shop-name">
    <div class="hero__identity">
      <div class="hero__logo">
        ${report.favicon
          ? `<img src="${imageUrl(report.favicon)}" alt="" loading="lazy" onerror="this.parentNode.textContent='${escape(initials(report.shopName))}'">`
          : escape(initials(report.shopName))}
      </div>
      <div class="hero__meta">
        <p class="eyebrow">Store intelligence · ${formatDate(report.analyzedAt)}</p>
        <h1 id="shop-name">${escape(report.shopName)}</h1>
        <a class="hero__domain" href="${escape(report.url)}" target="_blank" rel="noopener noreferrer">${escape(report.domain)} <span aria-hidden="true">↗</span></a>
        <p class="hero__desc">${escape(report.description || 'No store description published.')}</p>
        <div class="pillrow">
          ${facts.map(([variant, text]) => `<span class="pill ${variant ? `pill--${variant}` : ''}">${escape(text)}</span>`).join('')}
        </div>
      </div>
    </div>

    <div class="hero__score">
      ${gauge(activity.score, activity.tone)}
      <p class="hero__verdict verdict--${escape(activity.tone)}">${escape(activity.verdict)}</p>
      <p class="hero__caption">Activity score</p>
    </div>
  </section>`;
}

function renderSignals(report) {
  const { activity, catalog } = report;
  const rows = activity.signals
    .map(
      (signal) => `
      <li class="signal signal--${escape(signal.status)}">
        <div class="signal__top">
          <span class="signal__label">${escape(signal.label)}</span>
          <span class="signal__points">${signal.points}<em>/${signal.max}</em></span>
        </div>
        ${meter((signal.points / signal.max) * 100, signal.status)}
        <p class="signal__note">${escape(signal.note)}</p>
      </li>`
    )
    .join('');

  const headline = [
    catalog.launches.last30
      ? `${catalog.launches.last30}${catalog.isSampled ? '+' : ''} product${catalog.launches.last30 === 1 ? '' : 's'} launched in the last 30 days`
      : 'no new products in the last 30 days',
    activity.newestProductDays != null
      ? `newest item is ${relativeTime(catalog.latestProductAt)}`
      : null,
    report.blog ? `blog ${relativeTime(report.blog.latestPostAt)}` : 'no blog feed',
    `${report.socials.length} social channel${report.socials.length === 1 ? '' : 's'}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return `
  <section class="card signals-card" id="activity">
    <header class="card__head">
      <h2>Is this store active?</h2>
      <span class="badge badge--${escape(activity.tone)}">${escape(activity.verdict)}</span>
    </header>
    <p class="card__lead">${escape(headline)}.</p>
    <ul class="signals">${rows}</ul>
  </section>`;
}

function renderKpis(report) {
  const { catalog, shopify, socials, apps } = report;
  const currency = catalog.currency || shopify.currency || '';
  const tiles = [
    [catalog.publishedCount != null ? Number(catalog.publishedCount).toLocaleString('en-US') : '—', 'Published products'],
    [catalog.collectionCount != null ? Number(catalog.collectionCount).toLocaleString('en-US') : '—', 'Collections'],
    [catalog.price.min != null ? money(catalog.price.min, currency) : '—', 'Lowest price'],
    [catalog.price.median != null ? money(catalog.price.median, currency) : '—', 'Median price'],
    [catalog.price.max != null ? money(catalog.price.max, currency) : '—', 'Highest price'],
    [socials.length, 'Social channels'],
    [`${catalog.launches.last30}${catalog.isSampled ? '+' : ''}`, 'Launched (30d)'],
    [catalog.soldOutShare != null ? `${catalog.soldOutShare}%` : '—', 'Variants sold out'],
    [apps.length, 'Apps detected'],
    [storeRelative(report), 'Storefront'],
  ];

  return `
  <section class="kpis" aria-label="Key numbers">
    ${tiles
      .map(
        ([value, label]) => `
      <div class="kpi">
        <b>${escape(value)}</b>
        <span>${escape(label)}</span>
      </div>`
      )
      .join('')}
  </section>`;
}

function storeRelative(report) {
  if (report.storefront.passwordProtected) return 'Locked';
  if (report.storefront.blockedByBotWall) return 'Blocked';
  return report.storefront.status >= 200 && report.storefront.status < 400 ? 'Live' : `HTTP ${report.storefront.status}`;
}

function renderCharts(report) {
  const { catalog, shopify } = report;
  const currency = catalog.currency || shopify.currency || '';
  const peak = catalog.launches.months.reduce((best, month) => (month.count > best.count ? month : best), { month: '', count: 0 });
  const peakLabel = peak.month
    ? `${peak.count} in ${new Date(`${peak.month}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
    : 'none yet';

  const pricePositions = (() => {
    const { min, median, max } = catalog.price;
    if (min == null || max == null || max === min) return null;
    const place = (value) => Math.round(((value - min) / (max - min)) * 100);
    return { min: 0, median: place(median), max: 100 };
  })();

  return `
  <div class="grid grid--3to2">
    <section class="card" id="cadence">
      <header class="card__head">
        <h2>Launch cadence</h2>
        <span class="card__meta">peak ${peakLabel}</span>
      </header>
      ${launchChart(catalog.launches.months)}
      <p class="card__foot">Products published per month${catalog.isSampled ? ' (sampled catalog)' : ''}. ${catalog.launches.last90} in the last 90 days.</p>
    </section>

    <section class="card" id="mix">
      <header class="card__head"><h2>What they sell</h2></header>
      ${
        catalog.types.length
          ? `<ul class="mix">${catalog.types
              .map(
                (type) => `
            <li>
              <div class="mix__row"><span>${escape(type.name)}</span><b>${type.count}</b></div>
              ${meter(type.share, 'lime')}
              <small>${type.share}% of catalog</small>
            </li>`
              )
              .join('')}
            ${catalog.otherTypes ? `<li class="mix__more">+ ${catalog.otherTypes} smaller product types</li>` : ''}
          </ul>`
          : '<p class="muted">Product types are not labelled on this store, which is common for single-product or heavily tagged catalogs.</p>'
      }
      ${
        pricePositions
          ? `<div class="priceline">
              <div class="priceline__labels"><span>${escape(money(catalog.price.min, currency))}</span><span>${escape(money(catalog.price.max, currency))}</span></div>
              <div class="priceline__track">
                <i class="priceline__fill"></i>
                <b class="priceline__mark" style="left:${pricePositions.median}%" title="Median ${escape(money(catalog.price.median, currency))}"></b>
              </div>
              <small>Median ${escape(money(catalog.price.median, currency))} · average ${escape(money(catalog.price.average, currency))}</small>
            </div>`
          : ''
      }
    </section>
  </div>`;
}

function renderProducts(report) {
  const { catalog, shopify } = report;
  const currency = catalog.currency || shopify.currency || '';

  if (!catalog.newest.length) {
    return `
    <section class="card" id="catalog">
      <h2>Newest products</h2>
      <p class="muted">The storefront did not expose a product list, so individual products could not be sampled.</p>
    </section>`;
  }

  return `
  <section class="card" id="catalog">
    <header class="card__head">
      <h2>Newest products</h2>
      <span class="card__meta">latest added ${relativeTime(catalog.latestProductAt)}</span>
    </header>
    <div class="products">
      ${catalog.newest
        .map(
          (product) => `
        <article class="product">
          <div class="product__image">
            ${product.image
              ? `<img src="${imageUrl(product.image)}" alt="${escape(product.title)}" loading="lazy">`
              : `<span>${escape(initials(product.title, '—'))}</span>`}
          </div>
          <div class="product__body">
            <h3 title="${escape(product.title)}">${escape(product.title)}</h3>
            <div class="product__row">
              <span>${escape(product.type || product.vendor || 'Product')}</span>
              <b>${product.price != null ? escape(money(product.price, currency)) : '—'}</b>
            </div>
            <small class="product__stock ${product.available ? 'is-in' : 'is-out'}">${product.available ? 'In stock' : 'Sold out'} · ${escape(shortTime(product.publishedAt))}</small>
          </div>
        </article>`
        )
        .join('')}
    </div>
    ${
      catalog.tags.length
        ? `<h3 class="subhead">Merchandising tags</h3><div class="chips">${catalog.tags
            .map((tag) => chip(tag.name, '', tag.count))
            .join('')}</div>`
        : ''
    }
    ${
      catalog.vendors.length > 1
        ? `<h3 class="subhead">Brands / vendors</h3><div class="chips">${catalog.vendors
            .map((vendor) => chip(vendor.name, '', vendor.count))
            .join('')}</div>`
        : ''
    }
    ${
      catalog.options.length
        ? `<h3 class="subhead">Variants</h3><div class="chips">${catalog.options
            .map((option) => chip(option.name, 'outline', option.count))
            .join('')}</div>`
        : ''
    }
  </section>`;
}

function renderSocials(report) {
  const socials = report.socials;
  const contacts = report.contacts;

  return `
  <section class="card" id="socials">
    <header class="card__head">
      <h2>Social presence</h2>
      <span class="card__meta">${socials.length} found</span>
    </header>
    ${
      socials.length
        ? `<div class="socials">${socials
            .map(
              (social) => `
          <a class="social" href="${escape(social.url)}" target="_blank" rel="noopener nofollow noreferrer">
            <span class="social__dot" style="--dot:${escape(social.color)}"></span>
            <span class="social__text">
              <strong>${escape(social.label)}</strong>
              <em>${/^UC[A-Za-z0-9_-]{20,}$/.test(social.handle) ? 'YouTube channel' : `@${escape(social.handle.replace(/^@/, ''))}`}</em>
            </span>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>
          </a>`
            )
            .join('')}</div>`
        : '<p class="muted">No social profiles were found in the page source. They may be hidden inside images, an app widget, or a footer that only renders in the browser.</p>'
    }
    ${
      contacts.emails.length || contacts.phones.length
        ? `<h3 class="subhead">Contact details found</h3>
           ${contacts.emails.length ? `<p class="kv"><span>Email</span><b>${escape(contacts.emails.join(', '))}</b></p>` : ''}
           ${contacts.phones.length ? `<p class="kv"><span>Phone</span><b>${escape(contacts.phones.join(', '))}</b></p>` : ''}`
        : ''
    }
  </section>`;
}

function renderStack(report) {
  const { apps, shopify, storefront } = report;

  return `
  <section class="card" id="stack">
    <header class="card__head">
      <h2>Tech &amp; marketing stack</h2>
      <span class="card__meta">${apps.length} detected</span>
    </header>
    <div class="chips">${apps.length ? apps.map((app) => chip(app, 'app')).join('') : '<span class="muted">No third-party app signatures in the page source.</span>'}</div>

    <h3 class="subhead">Storefront signals</h3>
    <p class="kv"><span>HTTP status</span><b>${storefront.status} · ${storefront.responseMs} ms</b></p>
    <p class="kv"><span>Storefront</span><b>${storefront.passwordProtected ? 'Password protected — pre-launch' : storefront.blockedByBotWall ? 'Bot-protected' : 'Public and browsable'}</b></p>
    <p class="kv"><span>Shop Pay</span><b>${shopify.shopPay ? 'Enabled' : 'Not detected'}</b></p>
    <p class="kv"><span>Market</span><b>${escape(shopify.country || '—')}${shopify.shipsToCount ? ` · ships to ${shopify.shipsToCount} countries` : ''}</b></p>
    <p class="kv"><span>Locale</span><b>${escape(shopify.locale || '—')}</b></p>
    <p class="kv"><span>Shop ID</span><b class="mono">${escape(shopify.shopId || '—')}</b></p>
    ${shopify.myshopifyDomain ? `<p class="kv"><span>myshopify</span><b class="mono">${escape(shopify.myshopifyDomain)}</b></p>` : ''}

    <h3 class="subhead">Shopify evidence</h3>
    <div class="chips">${shopify.evidence.length ? shopify.evidence.map((item) => chip(item, 'outline')).join('') : '<span class="muted">—</span>'}</div>
  </section>`;
}

function renderAdvice(report) {
  const advice = buildAdvice(report);
  return `
  <section class="card advice" id="plan">
    <header class="card__head">
      <h2>What NEXTSCALE would do with this store</h2>
      <span class="card__meta">${advice.length} openings</span>
    </header>
    <ul class="advice__list">
      ${advice
        .map(
          (item) => `
        <li class="advice__item">
          <span class="advice__tag">${escape(item.tag)}</span>
          <div>
            <strong>${escape(item.headline)}</strong>
            <p>${escape(item.body)}</p>
          </div>
        </li>`
        )
        .join('')}
    </ul>
  </section>`;
}

function renderCaveats(report) {
  if (!report.warnings.length) return '';
  return `
  <section class="card caveats" id="caveats">
    <h2>Data caveats</h2>
    <ul>${report.warnings.map((warning) => `<li>${escape(warning)}</li>`).join('')}</ul>
  </section>`;
}

/* ------------------------------------------------------------------ */
/* page                                                               */
/* ------------------------------------------------------------------ */

function renderReport(report) {
  const tabs = [
    ['activity', 'Activity'],
    ['cadence', 'Catalog'],
    ['catalog', 'Products'],
    ['socials', 'Socials'],
    ['stack', 'Stack'],
    ['plan', 'Plan'],
  ];

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(report.shopName)} — Store Intelligence · NEXTSCALE AGENCY</title>
<link rel="stylesheet" href="/styles.css">
</head>
<body class="page-report">

<header class="topbar">
  <div class="shell topbar__inner">
    <a class="logo" href="/" aria-label="NEXTSCALE AGENCY home">
      <span class="logo__mark">NS</span>
      <span class="logo__text">NEXTSCALE<span>AGENCY</span></span>
    </a>
    <nav class="topbar__tabs" aria-label="Report sections">
      ${tabs.map(([id, label]) => `<a href="#${id}">${label}</a>`).join('')}
    </nav>
    <div class="topbar__actions">
      <a class="btn btn--ghost" href="/">New scan</a>
      <button class="btn" type="button" onclick="window.print()">Download PDF</button>
    </div>
  </div>
</header>

<main class="shell report">
  ${renderHero(report)}
  ${renderSignals(report)}
  ${renderKpis(report)}
  ${renderCharts(report)}
  ${renderProducts(report)}
  <div class="grid grid--2">
    ${renderSocials(report)}
    ${renderStack(report)}
  </div>
  ${renderAdvice(report)}
  ${renderCaveats(report)}

  <section class="cta">
    <div>
      <h2>Turn this scan into a growth plan</h2>
      <p>NEXTSCALE AGENCY builds the offer, funnel and paid-media plan behind stores like this one — starting from exactly this data.</p>
    </div>
    <a class="btn btn--big" href="/">Scan another store</a>
  </section>

  <footer class="foot">
    <span>NEXTSCALE AGENCY · store intelligence report</span>
    <span>Generated ${new Date(report.analyzedAt).toUTCString()} in ${report.durationMs} ms</span>
  </footer>
</main>
</body>
</html>`;
}

module.exports = { renderReport };
