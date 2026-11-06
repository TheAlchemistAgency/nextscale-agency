'use strict';

/**
 * src/env.js — zero-dependency .env loader.
 *
 * Runs before anything else so TEAM_PASSWORD, DATA_DIR, etc. survive a plain
 * `node server.js` restart without exporting variables by hand.
 * Values already present in the real environment always win.
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '.env');

function loadEnv(file = FILE) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return { loaded: false, keys: [] };
  }

  const keys = [];

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();

    // strip one layer of matching quotes (keeps apostrophes like LET'S intact)
    const quoted = /^(['"])([\s\S]*)\1$/.exec(value);
    if (quoted) value = quoted[2];

    if (process.env[key] === undefined) {
      process.env[key] = value;
      keys.push(key);
    }
  }

  return { loaded: true, keys };
}

module.exports = { loadEnv };
