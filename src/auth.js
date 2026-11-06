'use strict';

/**
 * src/auth.js — optional team gate.
 *
 * Set TEAM_PASSWORD on the host and the app asks for it before serving anything
 * useful. Leave it unset and the app is fully open (handy for local dev).
 *
 * Three ways in, so it works everywhere:
 *   1. the login form  -> sets an httpOnly cookie
 *   2. ?k=<password>   -> sets the cookie, then redirects to a clean URL
 *   3. x-team-key header -> for curl / API integrations
 */

const crypto = require('crypto');

const COOKIE = 'ns_team';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const password = () => process.env.TEAM_PASSWORD || '';

function signingSecret() {
  return (
    process.env.SESSION_SECRET ||
    crypto.createHash('sha256').update(`nextscale:${password()}`).digest('hex')
  );
}

function expectedToken() {
  return crypto.createHmac('sha256', signingSecret()).update('team-access-v1').digest('hex').slice(0, 40);
}

function safeEqual(a = '', b = '') {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function readCookie(header = '') {
  const match = header.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function setCookie(res) {
  res.setHeader(
    'set-cookie',
    `${COOKIE}=${expectedToken()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}${
      process.env.NODE_ENV === 'production' ? '; Secure' : ''
    }`
  );
}

const OPEN_PATHS = [/^\/login\/?$/, /^\/_auth\/?$/, /^\/api\/health\/?$/, /^\/favicon\.ico$/];
const OPEN_ASSET = /^\/(styles\.css|app\.js)$/;

/** Express middleware. No-ops entirely when TEAM_PASSWORD is not set. */
function gate(req, res, next) {
  if (!password()) return next();
  if (OPEN_PATHS.some((pattern) => pattern.test(req.path)) || OPEN_ASSET.test(req.path)) return next();

  // already signed in?
  if (safeEqual(readCookie(req.headers.cookie || ''), expectedToken())) return next();

  // ?k=<password> link (also lets the header-form API authenticate)
  const key = (req.query && req.query.k) || req.get('x-team-key') || '';
  if (key && safeEqual(key, password())) {
    setCookie(res);
    if (req.method === 'GET' && req.query.k) {
      const clean = req.originalUrl.replace(/([?&])k=[^&]*&?/, '$1').replace(/[?&]$/, '');
      return res.redirect(clean || '/');
    }
    return next();
  }

  // browser vs API
  const wantsHtml = req.method === 'GET' && !req.path.startsWith('/api/');
  if (!wantsHtml) return res.status(401).json({ error: 'Team password required. Add ?k=<password> or the x-team-key header.' });

  return res.status(401).type('html').send(loginPage());
}

function loginPage(error = '') {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Team access · NEXTSCALE AGENCY</title>
<link rel="stylesheet" href="/styles.css">
<style>
  .gate { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
  .gate__card {
    width: min(420px, 100%); padding: 34px; border-radius: 22px;
    background: linear-gradient(180deg, var(--surface-2), var(--surface));
    border: 1px solid var(--line-strong); box-shadow: var(--shadow-lift);
  }
  .gate h1 { font-size: 24px; margin: 18px 0 6px; }
  .gate p { color: var(--muted); font-size: 14px; }
  .gate input {
    width: 100%; margin: 16px 0 12px; padding: 13px 16px; border-radius: 12px;
    background: var(--surface-3); border: 1px solid var(--line-strong);
    color: var(--text); font: inherit; font-size: 15px; outline: none;
  }
  .gate input:focus { border-color: rgba(210,255,77,.6); box-shadow: 0 0 0 4px rgba(210,255,77,.12); }
  .gate button { width: 100%; }
  .gate__error { color: #ffb2c0; font-size: 13px; margin: 0 0 10px; }
</style>
</head>
<body class="page-report">
  <div class="gate">
    <div class="gate__card">
      <span class="logo">
        <span class="logo__mark">NS</span>
        <span class="logo__text">NEXTSCALE<span>AGENCY</span></span>
      </span>
      <h1>Team access</h1>
      <p>Enter the shared team password to open store intelligence.</p>
      <form method="post" action="/login">
        ${error ? `<p class="gate__error">${error}</p>` : ''}
        <input type="password" name="password" placeholder="Team password" autofocus autocomplete="current-password">
        <button class="btn btn--big" type="submit">Enter</button>
      </form>
    </div>
  </div>
</body>
</html>`;
}

/** Handles GET (show form) and POST (check password). */
function loginRoute(req, res) {
  if (req.method === 'POST') {
    const submitted = (req.body && req.body.password) || '';
    if (safeEqual(submitted, password())) {
      setCookie(res);
      return res.redirect('/');
    }
    return res.status(401).type('html').send(loginPage('That password is not right — try again.'));
  }
  return res.type('html').send(loginPage());
}

module.exports = { gate, loginRoute, isEnabled: () => Boolean(password()) };
