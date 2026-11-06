'use strict';

/**
 * src/store.js — report persistence.
 * Deliberately tiny: a JSON file on disk, newest 200 kept. Swap for a real
 * database when this grows up.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'reports.json');
const MAX_REPORTS = 200;

function readAll() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeAll(reports) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(reports, null, 2));
}

/** Save a report, return its id. */
function save(report) {
  const reports = readAll();
  const id = crypto.randomBytes(5).toString('hex');
  report.id = id;
  reports[id] = report;

  const ids = Object.keys(reports);
  if (ids.length > MAX_REPORTS) ids.slice(0, ids.length - MAX_REPORTS).forEach((old) => delete reports[old]);

  writeAll(reports);
  return id;
}

function get(id) {
  return readAll()[String(id)] || null;
}

/** Summary rows for the landing page. */
function recent(limit = 8) {
  return Object.values(readAll())
    .sort((a, b) => Date.parse(b.analyzedAt) - Date.parse(a.analyzedAt))
    .slice(0, limit)
    .map((report) => ({
      id: report.id,
      shopName: report.shopName,
      domain: report.domain,
      analyzedAt: report.analyzedAt,
      score: report.activity.score,
      verdict: report.activity.verdict,
      tone: report.activity.tone,
      favicon: report.favicon,
      products: report.catalog.publishedCount,
      socials: report.socials.length,
    }));
}

module.exports = { save, get, recent };
