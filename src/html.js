'use strict';

/**
 * src/html.js — everything we learn by reading a store's HTML.
 * Shopify embeds a lot of its own metadata in the page, so this module handles
 * theme detection, Shopify proof, social handles, contacts and app fingerprints.
 */

const SOCIALS = [
  {
    key: 'instagram',
    label: 'Instagram',
    color: '#E1306C',
    weight: 1.1,
    pattern: /instagram\.com\/([A-Za-z0-9_.]{2,40})\/?/i,
    profileUrl: (handle) => `https://www.instagram.com/${handle}/`,
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    color: '#25F4EE',
    weight: 1.3,
    pattern: /tiktok\.com\/@([A-Za-z0-9_.]{2,40})\/?/i,
    profileUrl: (handle) => `https://www.tiktok.com/@${handle}`,
  },
  {
    key: 'facebook',
    label: 'Facebook',
    color: '#1877F2',
    weight: 0.8,
    pattern: /facebook\.com\/([A-Za-z0-9_.-]{2,60})\/?/i,
    profileUrl: (handle) => `https://www.facebook.com/${handle}`,
  },
  {
    key: 'x',
    label: 'X (Twitter)',
    color: '#9aa3b2',
    weight: 0.9,
    pattern: /(?:x|twitter)\.com\/([A-Za-z0-9_]{2,30})\/?/i,
    profileUrl: (handle) => `https://x.com/${handle}`,
  },
  {
    key: 'youtube',
    label: 'YouTube',
    color: '#FF3D3D',
    weight: 0.9,
    pattern: /youtube\.com\/(?:c\/|channel\/|user\/|@)([A-Za-z0-9_.-]{2,60})/i,
    profileUrl: (handle) => `https://www.youtube.com/${handle.length > 20 && handle.startsWith('UC') ? 'channel/' : '@'}${handle}`,
  },
  {
    key: 'pinterest',
    label: 'Pinterest',
    color: '#BD081C',
    weight: 0.8,
    pattern: /pinterest\.[a-z.]{2,6}\/([A-Za-z0-9_.-]{2,60})\/?/i,
    profileUrl: (handle) => `https://www.pinterest.com/${handle}/`,
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    color: '#0A66C2',
    weight: 0.6,
    pattern: /linkedin\.com\/(?:company|in|school)\/([A-Za-z0-9_.%-]{2,80})\/?/i,
    profileUrl: (handle) => `https://www.linkedin.com/company/${handle}/`,
  },
  {
    key: 'snapchat',
    label: 'Snapchat',
    color: '#FFFC00',
    weight: 0.7,
    pattern: /snapchat\.com\/add\/([A-Za-z0-9_.-]{2,40})/i,
    profileUrl: (handle) => `https://www.snapchat.com/add/${handle}`,
  },
  {
    key: 'threads',
    label: 'Threads',
    color: '#cfd5e0',
    weight: 0.8,
    pattern: /threads\.(?:net|com)\/@([A-Za-z0-9_.]{2,40})/i,
    profileUrl: (handle) => `https://www.threads.net/@${handle}`,
  },
  {
    key: 'discord',
    label: 'Discord',
    color: '#5865F2',
    weight: 0.4,
    pattern: /discord\.(?:gg|com\/invite)\/([A-Za-z0-9\-_]{2,40})/i,
    profileUrl: (handle) => `https://discord.gg/${handle}`,
  },
  {
    key: 'telegram',
    label: 'Telegram',
    color: '#229ED9',
    weight: 0.4,
    pattern: /(?:t\.me|telegram\.me)\/([A-Za-z0-9_]{2,40})/i,
    profileUrl: (handle) => `https://t.me/${handle}`,
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    color: '#25D366',
    weight: 0.4,
    pattern: /(?:whatsapp\.com\/send\/?\?phone=|wa\.me\/)([0-9+]{6,20})/i,
    profileUrl: (handle) => `https://wa.me/${String(handle).replace(/\D/g, '')}`,
  },
];

const SOCIAL_ORDER = SOCIALS.map((social) => social.key);

// Path fragments that are never a brand handle.
const NOT_A_HANDLE = new Set([
  'p', 'reel', 'reels', 'explore', 'accounts', 'sharer', 'share', 'sharearticle', 'intent', 'tr',
  'profile.php', 'home', 'login', 'signup', 'legal', 'privacy', 'help', 'policies', 'about', 'watch',
  'hashtag', 'tv', 'stories', 'embed', 'widgets', 'dialog', 'plugins', 'channel', 'c', 'user',
  'search', 'results', 'settings', 'terms', 'direct', 'groups', 'pages', 'events', 'marketplace',
  'submit', 'pin', 'playlist', 'feed', 'company', 'school', 'posts', 'jobs', 'showcase', 'photo.php',
  'permalink.php', 'story.php', 'media', 'invite', 'add', 'send',
]);

const APPS = [
  ['Klaviyo', /klaviyo/i],
  ['Privy', /privy\.com|PrivyEmbed/i],
  ['Omnisend', /omnisend/i],
  ['Mailchimp', /chimpstatic|mailchimp/i],
  ['Attentive', /attentive(mobile)?\.com|attn\.tv/i],
  ['Postscript', /postscript\.io/i],
  ['Yotpo', /yotpo/i],
  ['Judge.me', /judge\.me/i],
  ['Okendo', /okendo/i],
  ['Stamped.io', /stamped\.io/i],
  ['Loox', /loox\.io|loox-cdn/i],
  ['Recharge', /rechargepayments|rechargecdn/i],
  ['Bold Subscriptions', /boldapps|bold-subscriptions/i],
  ['Reconvert', /reconvert/i],
  ['Gorgias', /gorgias/i],
  ['Tidio', /tidio/i],
  ['Zendesk', /zendesk/i],
  ['Intercom', /intercom/i],
  ['Re:amaze', /reamaze/i],
  ['Hotjar', /hotjar/i],
  ['Microsoft Clarity', /clarity\.ms/i],
  ['Google Analytics 4', /gtag\('config',\s*'G-|googletagmanager\.com\/gtag/i],
  ['Meta Pixel', /connect\.facebook\.net\/[^"']*fbevents/i],
  ['TikTok Pixel', /analytics\.tiktok\.com/i],
  ['Pinterest Tag', /pintrk|ct\.pinterest\.com/i],
  ['Snap Pixel', /sc-static\.net\/scevent/i],
  ['Google Ads', /googleadservices|AW-\d{6,}/],
  ['Rebuy', /rebuyengine|rebuy\.js/i],
  ['Nosto', /nosto/i],
  ['Searchanise', /searchanise/i],
  ['Algolia', /algolia/i],
  ['Boost Commerce', /boostcommerce|boost-pfs/i],
  ['Recart', /recart/i],
  ['Weglot', /weglot/i],
  ['Shopify Markets', /Shopify\.currency|Shopify\.locale/i],
  ['Route', /routeapp|route\.com\/widget/i],
  ['Affirm', /affirm\.com/i],
  ['Klarna', /klarna/i],
  ['Afterpay / Clearpay', /afterpay|clearpay/i],
  ['Sezzle', /sezzle/i],
  ['PayPal', /paypal\.com\/sdk|paypalobjects/i],
  ['Avalara', /avalara/i],
  ['Shopify Subscriptions', /subscription-contracts|selling_plan/i],
];

const PRETTY = {
  '&amp;': '&',
  '&#39;': "'",
  '&#x27;': "'",
  '&apos;': "'",
  '&quot;': '"',
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' ',
};

function unescapeHtml(value = '') {
  return String(value).replace(/&(amp|#39|#x27|apos|quot|lt|gt|nbsp);/gi, (match) => PRETTY[match.toLowerCase()] ?? match);
}

function stripTags(value = '') {
  return unescapeHtml(
    String(value)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

const pick = (html, pattern) => {
  const match = html.match(pattern);
  return match ? unescapeHtml(match[1]).trim() : '';
};

/** Title, description, favicon, og image — the basics. */
function readPageBasics(html) {
  return {
    title: pick(html, /<title[^>]*>([\s\S]*?)<\/title>/i).replace(/\s+/g, ' '),
    siteName: pick(html, /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']*)["']/i),
    description:
      pick(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
      pick(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i),
    ogImage: pick(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i),
    favicon: pick(html, /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i),
  };
}

/**
 * Shopify ships its theme config as JSON in the page (sometimes inside an
 * escaped attribute), so these patterns allow backslashes between tokens.
 */
function readShopifySignals(html, finalUrl) {
  const themeName =
    pick(html, /Shopify\.theme\W*=?\W*\{[\s\S]{0,220}?\bname\b\W*:\W*["']([^"']+)["']/i) ||
    pick(html, /["']theme_name["']\W*:\W*["']([^"']+)["']/i);

  const themeId = pick(html, /Shopify\.theme\W*=?\W*\{[\s\S]{0,260}?\bid\b\W*:\W*(\d+)/i);

  const evidence = [
    ['cdn.shopify.com assets', /cdn\.shopify\.com/i],
    ['Shopify JS object', /Shopify\.(shop|theme|currency|routes|locale)\s*=/i],
    ['myshopify.com reference', /[a-z0-9-]+\.myshopify\.com/i],
    ['Shopify checkout scripts', /shopifycloud|checkout\.shopify\.com/i],
    ['Shopify analytics', /shopify-analytics|monorail-edge\.shopify\.com/i],
  ]
    .filter(([, pattern]) => pattern.test(html))
    .map(([label]) => label);

  return {
    isShopify: evidence.length > 0,
    evidence,
    themeName: themeName ? themeName.replace(/[[\]]/g, '').trim() : null,
    themeId: themeId ? Number(themeId) : null,
    currency: pick(html, /Shopify\.currency\W*=?\W*\{[\s\S]{0,160}?\bactive\b\W*:\W*["']([^"']+)["']/i) || null,
    locale: pick(html, /Shopify\.locale\W*=?\W*["']([^"']+)["']/i) || null,
    country: pick(html, /Shopify\.country\W*=?\W*["']([^"']+)["']/i) || null,
    hasCart: /action=["']\/cart\/add/i.test(html) || /"cart_route"|cart_add_url/i.test(html),
    passwordProtected:
      /\/password\/?$/i.test(String(finalUrl || '').replace(/[?#].*$/, '')) ||
      /action=["']\/?password/i.test(html) ||
      /<title>[^<]{0,80}(password|opening soon)/i.test(html),
  };
}

function isBotWall(status, html, title) {
  if (status === 403 || status === 429) return true;
  if (/access denied|just a moment|attention required|are you a robot|request blocked|pardon our interruption|^error/i.test(String(title || '').toLowerCase())) {
    return true;
  }
  return /cf-browser-verification|_Incapsula_Resource|captcha-delivery\.com|akamai.*reference\s*#/i.test(html || '');
}

/**
 * Pull social profiles out of one page of HTML.
 * Scans the whole document plus JSON-LD "sameAs" arrays.
 */
function readSocials(html) {
  if (!html) return [];
  const found = new Map();

  const remember = (social, rawHandle) => {
    const handle = String(rawHandle || '').replace(/^@/, '').replace(/\/$/, '').trim();
    if (handle.length < 2) return;
    if (NOT_A_HANDLE.has(handle.toLowerCase())) return;
    if (/^(https?|www|javascript)/i.test(handle)) return;
    if (found.has(social.key)) return;

    found.set(social.key, {
      key: social.key,
      label: social.label,
      color: social.color,
      weight: social.weight,
      handle,
      url: social.profileUrl(handle),
    });
  };

  const scan = (source) => {
    for (const social of SOCIALS) {
      const match = String(source).match(social.pattern);
      if (match) remember(social, match[1]);
    }
  };

  scan(html);
  for (const block of String(html).match(/"sameAs"\s*:\s*\[[^\]]+\]/gi) || []) scan(block);

  return [...found.values()].sort((a, b) => SOCIAL_ORDER.indexOf(a.key) - SOCIAL_ORDER.indexOf(b.key));
}

/** Combine the socials found across several host variants of the same store. */
function mergeSocials(lists) {
  const merged = new Map();
  for (const list of lists) {
    for (const social of list) if (!merged.has(social.key)) merged.set(social.key, social);
  }
  return [...merged.values()].sort((a, b) => SOCIAL_ORDER.indexOf(a.key) - SOCIAL_ORDER.indexOf(b.key));
}

function readContacts(html) {
  const emails = [
    ...new Set(
      (String(html).match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [])
        .map((email) => email.toLowerCase())
        .filter((email) => !/\.(png|jpe?g|gif|webp|svg)$/.test(email))
        .filter((email) => !/^(no-?reply|example|wixpress)/.test(email))
        .filter((email) => !/(sentry|ingest|segment|amplitude|datadog|bugsnag|rollbar|logrocket|hotjar)/.test(email))
        .filter((email) => !/[0-9a-f]{20,}/.test(email.split('@')[0]))
    ),
  ].slice(0, 4);

  const phones = [
    ...new Set((String(html).match(/tel:\+?[0-9()\-\s.]{7,20}/gi) || []).map((tel) => tel.replace(/^tel:/i, '').trim())),
  ].slice(0, 3);

  return { emails, phones };
}

function readApps(html) {
  return APPS.filter(([, pattern]) => pattern.test(html)).map(([name]) => name);
}

module.exports = {
  SOCIALS,
  SOCIAL_ORDER,
  readPageBasics,
  readShopifySignals,
  readSocials,
  mergeSocials,
  readContacts,
  readApps,
  isBotWall,
  unescapeHtml,
  stripTags,
};
