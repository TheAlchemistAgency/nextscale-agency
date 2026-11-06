#!/usr/bin/env node
'use strict';

/**
 * Quick smoke test: node scripts/check.js store.com [store2.com ...]
 * Prints a one-line summary per store, or VERBOSE=1 for the full picture.
 */

const { analyzeStore } = require('../src/analyze');

(async () => {
  const targets = process.argv.slice(2);
  if (!targets.length) {
    console.log('Usage: node scripts/check.js <store.com> [more.com ...]');
    process.exit(1);
  }

  for (const target of targets) {
    try {
      const report = await analyzeStore(target);
      const { catalog, activity, shopify, socials } = report;

      console.log(
        [
          target.padEnd(28),
          (report.shopName || '').slice(0, 22).padEnd(24),
          `shopify=${shopify.isShopify}`,
          `score=${activity.score} (${activity.verdict})`,
          `products=${catalog.publishedCount}`,
          `socials=${socials.length}`,
          `apps=${report.apps.length}`,
          `blocked=${report.storefront.blockedByBotWall}`,
        ].join(' | ')
      );

      if (process.env.VERBOSE) {
        console.log('   socials :', socials.map((social) => `${social.label}@${social.handle}`).join(', ') || '—');
        console.log('   types   :', catalog.types.slice(0, 4).map((type) => `${type.name}(${type.count})`).join(', ') || '—');
        console.log('   price   :', catalog.price.min, '-', catalog.price.max, '| median', catalog.price.median);
        console.log('   launches:', catalog.launches.months.map((month) => `${month.month}:${month.count}`).join(' '));
        console.log('   apps    :', report.apps.join(', ') || '—');
        console.log('   warnings:', report.warnings.length ? report.warnings : 'none');
      }
    } catch (error) {
      console.log(target.padEnd(28), '| ERROR:', error.message);
    }
  }
})();
