'use strict';

/**
 * src/net.js — HTTP plumbing
 * Every outbound request in NEXTSCALE goes through here so we get one place
 * for timeouts, user agents, redirects and human-readable failures.
 */

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const HTML_ACCEPT = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

/** Turn user input ("store.com", "https://www.store.com/x") into a URL object. */
function toUrl(input) {
  if (typeof input !== 'string' || !input.trim()) throw new UserError('Enter a store URL to analyze.');
  let raw = input.trim().replace(/\s+/g, '');
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new UserError(`"${input.trim()}" isn't a valid URL.`);
  }
  if (!/\./.test(url.hostname) || /^\.+$/.test(url.hostname)) {
    throw new UserError(`"${url.hostname}" isn't a valid domain — try something like yourstore.com`);
  }
  if (!/^https?:$/.test(url.protocol)) throw new UserError('Only http and https URLs can be analyzed.');

  url.hash = '';
  return url;
}

/** An error we are happy to show the user verbatim. */
class UserError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UserError';
    this.expose = true;
  }
}

function describeFailure(error) {
  const name = error && error.name;
  const code =
    (error && error.cause && (error.cause.code || error.cause.errno)) || (error && error.code) || '';

  if (name === 'AbortError') return 'the request timed out — the store took too long to respond';
  if (/ENOTFOUND|EAI_AGAIN/.test(code)) return 'that domain does not exist — check the spelling';
  if (/ECONNREFUSED/.test(code)) return 'the server refused the connection';
  if (/CERT|SSL|TLS|UNABLE_TO_VERIFY/.test(String(code))) return 'the site has an invalid SSL certificate';
  if (/ECONNRESET|EPIPE|UND_ERR/.test(String(code))) return 'the connection was reset by the store';
  return (error && error.message) || 'network error (DNS, TLS or connection refused)';
}

/**
 * Fetch with a timeout. Never throws: failures come back as { ok: false, status: 0, error }.
 * @returns {Promise<{ok:boolean,status:number,url:string,body:string,ms:number,error?:string}>}
 */
async function request(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout ?? 15000);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': options.userAgent || USER_AGENT,
        accept: options.accept || HTML_ACCEPT,
        'accept-language': 'en-US,en;q=0.9',
        'cache-control': 'no-cache',
        ...(options.headers || {}),
      },
    });

    return {
      ok: response.ok,
      status: response.status,
      url: response.url || url,
      body: await response.text(),
      ms: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      url,
      body: '',
      ms: Date.now() - startedAt,
      error: describeFailure(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** request() for JSON endpoints. Returns null when the payload isn't JSON. */
async function requestJson(url, options = {}) {
  const response = await request(url, { accept: 'application/json', ...options });
  if (!response.ok) return { data: null, response };

  try {
    return { data: JSON.parse(response.body), response };
  } catch {
    return { data: null, response };
  }
}

module.exports = { request, requestJson, toUrl, UserError, USER_AGENT };
