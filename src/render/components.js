'use strict';

/**
 * src/render/components.js — tiny, dependency-free HTML/SVG building blocks.
 */

const escape = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const DAY_MS = 86400000;

function money(amount, currency = '') {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  const value = Number(amount);
  const text = value >= 1000 ? value.toLocaleString('en-US', { maximumFractionDigits: 0 }) : value.toFixed(2);
  return currency ? `${currency} ${text}` : text;
}

function formatDate(iso) {
  const date = new Date(iso || '');
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function daysAgo(iso) {
  const time = Date.parse(iso || '');
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.round((Date.now() - time) / DAY_MS));
}

function relativeTime(iso) {
  const days = daysAgo(iso);
  if (days == null) return 'unknown';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  return `${(days / 365).toFixed(1)} years ago`;
}

function shortTime(iso) {
  const days = daysAgo(iso);
  if (days == null) return '—';
  if (days === 0) return 'today';
  if (days === 1) return '1d ago';
  if (days < 14) return `${days}d ago`;
  if (days < 60) return `${Math.round(days / 7)}w ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${(days / 365).toFixed(1)}y ago`;
}

function initials(name, fallback = '??') {
  const words = String(name || '').split(/\s+/).filter(Boolean);
  if (!words.length) return fallback;
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

/** Animated radial score gauge. */
function gauge(score, tone, size = 168) {
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.max(0, Math.min(100, score)) / 100) * circumference;
  const center = size / 2;

  return `
    <div class="gauge gauge--${escape(tone)}" style="--size:${size}px">
      <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
        <circle class="gauge__track" cx="${center}" cy="${center}" r="${radius}" stroke-width="10" />
        <circle class="gauge__value" cx="${center}" cy="${center}" r="${radius}" stroke-width="10"
          stroke-dasharray="${filled.toFixed(1)} ${circumference.toFixed(1)}"
          stroke-dashoffset="0" transform="rotate(-90 ${center} ${center})" />
      </svg>
      <div class="gauge__label">
        <strong>${score}</strong>
        <span>/ 100</span>
      </div>
    </div>`;
}

/** Twelve-month launch cadence, drawn as SVG columns. */
function launchChart(months = []) {
  const width = 560;
  const height = 132;
  const gap = 8;
  const count = Math.max(months.length, 1);
  const barWidth = (width - gap * (count - 1)) / count;
  const peak = Math.max(1, ...months.map((month) => month.count));

  const bars = months
    .map((month, index) => {
      const barHeight = Math.round((month.count / peak) * (height - 34));
      const x = index * (barWidth + gap);
      const y = height - 22 - barHeight;
      const label = new Date(`${month.month}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short' });
      const showLabel = count <= 12 || index % 2 === 0;

      return `
        <g class="chart__col">
          <title>${label}: ${month.count} product${month.count === 1 ? '' : 's'}</title>
          <rect class="chart__bar" x="${x.toFixed(1)}" y="${y}" width="${barWidth.toFixed(1)}" height="${Math.max(barHeight, 2)}" rx="3" />
          ${showLabel ? `<text class="chart__tick" x="${(x + barWidth / 2).toFixed(1)}" y="${height - 4}" text-anchor="middle">${label}</text>` : ''}
          ${month.count ? `<text class="chart__value" x="${(x + barWidth / 2).toFixed(1)}" y="${y - 6}" text-anchor="middle">${month.count}</text>` : ''}
        </g>`;
    })
    .join('');

  return `
    <svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Products published per month">
      ${bars}
    </svg>`;
}

/** Horizontal percentage bar. */
function meter(percent, tone = '') {
  const width = Math.max(2, Math.min(100, Number(percent) || 0));
  return `<div class="meter ${tone ? `meter--${escape(tone)}` : ''}"><i style="width:${width}%"></i></div>`;
}

function chip(text, variant = '', count) {
  return `<span class="chip ${variant ? `chip--${escape(variant)}` : ''}">${escape(text)}${
    count != null ? `<i>${escape(count)}</i>` : ''
  }</span>`;
}

const TONE_WORD = { good: 'Healthy', watch: 'Watch', poor: 'Weak' };

module.exports = {
  escape,
  money,
  formatDate,
  relativeTime,
  shortTime,
  daysAgo,
  initials,
  gauge,
  launchChart,
  meter,
  chip,
  TONE_WORD,
};
