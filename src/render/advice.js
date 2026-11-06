'use strict';

/**
 * src/render/advice.js — turns the data into the agency's point of view.
 * Each item is a real observation plus what NEXTSCALE would pitch because of it.
 */

const hasApp = (apps, pattern) => apps.some((app) => pattern.test(app));

function buildAdvice(report) {
  const { catalog, activity, apps, socials } = report;
  const socialKeys = new Set(socials.map((social) => social.key));
  const advice = [];

  if (catalog.launches.last30 >= 10) {
    advice.push({
      tag: 'Launch cadence',
      headline: `${catalog.launches.last30}${catalog.isSampled ? '+' : ''} products in 30 days`,
      body: 'This is a heavy drop schedule. Every drop needs fresh paid creative to land, so creative volume — not budget — is usually the bottleneck here. Strong opening pitch for a media-buying retainer.',
    });
  } else if (catalog.launches.last30 >= 1) {
    advice.push({
      tag: 'Launch cadence',
      headline: `${catalog.launches.last30} product${catalog.launches.last30 === 1 ? '' : 's'} in 30 days`,
      body: 'The store is still shipping, but slowly. A predictable monthly drop calendar plus launch-day email/SMS flows is the easiest growth win to scope.',
    });
  }

  if (activity.newestProductDays != null && activity.newestProductDays > 90) {
    advice.push({
      tag: 'Dormant catalog',
      headline: `Newest product is ${activity.newestProductDays} days old`,
      body: 'The catalog has gone quiet. Either the brand is winding down (be careful) or merchandising is neglected (opportunity). Lead with a relaunch or collection-refresh proposal.',
    });
  }

  if (catalog.soldOutShare != null && catalog.soldOutShare >= 25) {
    advice.push({
      tag: 'Inventory',
      headline: `${catalog.soldOutShare}% of variants sold out`,
      body: 'Demand is outrunning supply, or the catalog is stale. Either way it is a conversation: restock velocity, waitlists, and how sold-out pages are converting.',
    });
  }

  if (!report.blog) {
    advice.push({
      tag: 'Content gap',
      headline: 'No blog or content feed found',
      body: 'SEO and email-driven content is an open lane. This is the fastest first retainer to sell: a content engine feeding both organic search and lifecycle email.',
    });
  } else if (activity.blogDays > 90) {
    advice.push({
      tag: 'Content gap',
      headline: `Blog last updated ${activity.blogDays} days ago`,
      body: 'The store still sells while content is dormant — a quick, visible win that gives you something concrete to show in the first 30 days.',
    });
  }

  if (!socialKeys.has('tiktok')) {
    advice.push({
      tag: 'Channel gap',
      headline: 'No TikTok linked',
      body: 'If the catalog is visual (fashion, beauty, home, food, fitness), short-form video is the most obvious untapped channel. Pair it with creator seeding rather than brand-owned posting.',
    });
  } else if (socialKeys.size <= 2) {
    advice.push({
      tag: 'Channel gap',
      headline: `Only ${socialKeys.size} social channel${socialKeys.size === 1 ? '' : 's'}`,
      body: 'A thin social footprint means little owned audience to retarget. Building one or two additional surfaces (YouTube Shorts, Pinterest) compounds with paid media.',
    });
  }

  if (!hasApp(apps, /Klaviyo|Omnisend|Privy|Mailchimp|Attentive|Postscript/i)) {
    advice.push({
      tag: 'Retention',
      headline: 'No email or SMS platform detected',
      body: 'A first-party list is the highest-ROI install at this stage. Welcome, abandoned-cart and winback flows typically pay for themselves inside a month.',
    });
  }

  if (!hasApp(apps, /Yotpo|Judge\.me|Okendo|Stamped|Loox/i)) {
    advice.push({
      tag: 'Conversion',
      headline: 'No reviews app detected',
      body: 'Product-page social proof is one of the cheapest conversion lifts to scope — photo reviews plus a UGC gallery usually move the needle within weeks.',
    });
  }

  if (!hasApp(apps, /Meta Pixel|TikTok Pixel|Google Ads|Google Analytics/i)) {
    advice.push({
      tag: 'Measurement',
      headline: 'No ad or analytics pixels found in source',
      body: 'You cannot scale what you cannot measure. Fix tracking (GA4 + server-side events) before proposing any spend increase.',
    });
  }

  if (catalog.price.median != null && catalog.price.min != null && catalog.price.median <= catalog.price.min * 1.6) {
    advice.push({
      tag: 'AOV',
      headline: 'Flat price band across the catalog',
      body: 'Almost everything sits at the same price point. Bundles, a premium tier or a subscription are the obvious levers to lift average order value.',
    });
  }

  if (!advice.length) {
    advice.push({
      tag: 'Scale-up',
      headline: 'Fundamentals look healthy',
      body: 'Fresh products, live content and a full social footprint. The conversation here is scaling paid media and retention — not fixing basics.',
    });
  }

  return advice.slice(0, 5);
}

module.exports = { buildAdvice };
