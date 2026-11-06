/* NEXTSCALE AGENCY — landing page behaviour */
(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);

  const form = $('#scanner');
  const input = $('#store-url');
  const button = $('#scan-button');
  const progress = $('#progress');
  const progressStep = $('#progress-step');
  const alertBox = $('#alert');

  /* ---------------- scanning ---------------- */

  const STEPS = [
    'Connecting to the storefront…',
    'Confirming the Shopify platform…',
    'Pulling the catalog and pricing…',
    'Scanning social profiles…',
    'Reading launch history…',
    'Scoring activity and building the report…',
  ];

  let stepTimer = null;
  let stepIndex = 0;

  function startProgress() {
    stepIndex = 0;
    progress.hidden = false;
    alertBox.hidden = true;
    progressStep.textContent = STEPS[0];
    clearInterval(stepTimer);
    stepTimer = setInterval(() => {
      stepIndex = Math.min(stepIndex + 1, STEPS.length - 1);
      progressStep.textContent = STEPS[stepIndex];
      if (stepIndex === STEPS.length - 1) clearInterval(stepTimer);
    }, 1100);
  }

  function stopProgress() {
    clearInterval(stepTimer);
    progress.hidden = true;
  }

  function showError(message) {
    alertBox.textContent = message;
    alertBox.hidden = false;
  }

  function setBusy(busy) {
    button.disabled = busy;
    button.textContent = busy ? 'Scanning…' : 'Scan store';
    input.readOnly = busy;
  }

  document.querySelectorAll('#samples button').forEach((sample) => {
    sample.addEventListener('click', () => {
      input.value = sample.dataset.url;
      input.focus();
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const url = input.value.trim();

    if (!url) {
      showError('Enter a store URL — for example yourstore.com');
      input.focus();
      return;
    }

    setBusy(true);
    startProgress();

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(data.error || 'That scan failed — try again in a moment.');
      stopProgress();
      window.location.assign(`/r/${data.id}`);
    } catch (error) {
      stopProgress();
      setBusy(false);
      showError(error.message);
    }
  });

  /* ---------------- recent scans ---------------- */

  const feed = $('#feed-grid');

  const initials = (name = '') => {
    const words = name.split(/\s+/).filter(Boolean);
    if (!words.length) return '—';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  };

  const timeAgo = (iso) => {
    const days = Math.round((Date.now() - Date.parse(iso)) / 86400000);
    if (!Number.isFinite(days) || days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days} days ago`;
    return `${Math.round(days / 30)} months ago`;
  };

  const escapeHtml = (value = '') =>
    String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  async function loadFeed() {
    try {
      const response = await fetch('/api/reports');
      const reports = await response.json();
      if (!Array.isArray(reports) || !reports.length) return;

      feed.innerHTML = reports
        .map(
          (report, index) => `
        <a class="feed-card" href="/r/${report.id}" style="animation-delay:${index * 40}ms">
          <span class="feed-card__logo">${
            report.favicon
              ? `<img src="/api/image?src=${encodeURIComponent(report.favicon)}" alt="" loading="lazy" onerror="this.parentNode.textContent='${initials(report.shopName)}'">`
              : initials(report.shopName)
          }</span>
          <span class="feed-card__body">
            <b>${escapeHtml(report.shopName)}</b>
            <em>${escapeHtml(report.domain)} · ${timeAgo(report.analyzedAt)}</em>
          </span>
          <span class="feed-card__score score--${report.tone}">${report.score}</span>
        </a>`
        )
        .join('');
    } catch {
      /* the feed is a nice-to-have; the scanner still works without it */
    }
  }

  loadFeed();
})();
