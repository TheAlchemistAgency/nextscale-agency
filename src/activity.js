'use strict';

/**
 * src/activity.js — the "is this store alive?" score.
 *
 * Five weighted signals, 100 points total:
 *   32  product freshness   (age of the newest product)
 *   24  launch velocity     (products published in the last 30 days)
 *   14  content cadence     (age of the newest blog post)
 *   15  social footprint    (how many networks are linked)
 *   15  storefront health   (HTTP status, password wall, bot walls)
 */

const DAY_MS = 86400000;

const daysSince = (iso) => {
  const time = Date.parse(iso || '');
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.round((Date.now() - time) / DAY_MS));
};

const band = (value, steps) => {
  for (const [limit, points] of steps) if (value <= limit) return points;
  return 0;
};

function scoreActivity({ catalog, socials, blog, storefront }) {
  const signals = [];

  /* --- product freshness ------------------------------------------ */
  const newestProductDays = daysSince(catalog.latestProductAt);
  let freshness = 0;
  let freshnessNote = 'No publish dates were available';

  if (newestProductDays != null) {
    freshness = band(newestProductDays, [[7, 32], [30, 27], [90, 18], [180, 10], [365, 4]]);
    freshnessNote =
      newestProductDays <= 7
        ? 'A product went live this week'
        : `Newest product is ${newestProductDays} days old`;
  }
  signals.push({
    key: 'freshness',
    label: 'Product freshness',
    note: freshnessNote,
    points: freshness,
    max: 32,
    status: freshness >= 27 ? 'good' : freshness >= 10 ? 'watch' : 'poor',
  });

  /* --- launch velocity -------------------------------------------- */
  const newIn30 = catalog.launches.last30 || 0;
  const velocity = newIn30 >= 10 ? 24 : newIn30 >= 3 ? 18 : newIn30 >= 1 ? 10 : 0;
  signals.push({
    key: 'velocity',
    label: 'Launch velocity',
    note: newIn30
      ? `${newIn30}${catalog.isSampled ? '+' : ''} product${newIn30 === 1 ? '' : 's'} published in 30 days`
      : 'Nothing published in the last 30 days',
    points: velocity,
    max: 24,
    status: velocity >= 18 ? 'good' : velocity > 0 ? 'watch' : 'poor',
  });

  /* --- content cadence -------------------------------------------- */
  const blogDays = daysSince(blog && blog.latestPostAt);
  let content = 0;
  let contentNote = 'No blog or content feed found';

  if (blogDays != null) {
    content = band(blogDays, [[30, 14], [90, 10], [365, 5]]);
    contentNote = blogDays <= 90 ? `Blog post ${blogDays} days ago` : `Blog last touched ${blogDays} days ago`;
  }
  signals.push({
    key: 'content',
    label: 'Content cadence',
    note: contentNote,
    points: content,
    max: 14,
    status: content >= 10 ? 'good' : content > 0 ? 'watch' : 'poor',
  });

  /* --- social footprint ------------------------------------------- */
  const socialPoints = Math.min(15, Math.round(socials.reduce((total, social) => total + social.weight * 5, 0)));
  signals.push({
    key: 'social',
    label: 'Social footprint',
    note: socials.length
      ? `${socials.length} network${socials.length === 1 ? '' : 's'}: ${socials.map((social) => social.label).join(', ')}`
      : 'No social profiles linked',
    points: socialPoints,
    max: 15,
    status: socialPoints >= 10 ? 'good' : socialPoints > 0 ? 'watch' : 'poor',
  });

  /* --- storefront health ------------------------------------------ */
  let health = 0;
  let healthNote = 'Storefront did not respond';

  if (storefront.blockedByBotWall) {
    health = 7;
    healthNote = 'Storefront blocks crawlers — page state unverified';
  } else if (storefront.passwordProtected) {
    health = 2;
    healthNote = 'Password protected / pre-launch';
  } else if (storefront.status >= 200 && storefront.status < 400) {
    health = 15;
    healthNote = 'Loads normally and is publicly browsable';
  } else if (storefront.status >= 400) {
    healthNote = `Storefront returned HTTP ${storefront.status}`;
  }
  signals.push({
    key: 'health',
    label: 'Storefront health',
    note: healthNote,
    points: health,
    max: 15,
    status: health >= 10 ? 'good' : health > 0 ? 'watch' : 'poor',
  });

  /* --- verdict ---------------------------------------------------- */
  const score = Math.max(0, Math.min(100, signals.reduce((total, signal) => total + signal.points, 0)));

  const VERDICTS = [
    [78, 'Highly active', 'good'],
    [58, 'Active', 'good'],
    [38, 'Moderately active', 'watch'],
    [18, 'Low activity', 'watch'],
    [0, 'Dormant / possibly inactive', 'poor'],
  ];

  let [, verdict, tone] = VERDICTS.find(([floor]) => score >= floor) || VERDICTS[VERDICTS.length - 1];
  if (!catalog.sampledCount) {
    verdict = 'Could not confirm activity';
    tone = 'watch';
  }

  return { score, verdict, tone, signals, newestProductDays, blogDays };
}

module.exports = { scoreActivity };
