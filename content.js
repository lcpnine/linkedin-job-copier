(function () {
  'use strict';

  if (window.__ljcInjectedVersion === 3) return;
  window.__ljcInjectedVersion = 3;

  const BUTTON_ID = 'ljc-copy-btn';
  const TOAST_ID  = 'ljc-toast';

  const JOB_TITLE_SELECTORS = [
    '.job-details-jobs-unified-top-card__job-title h1',
    '.job-details-jobs-unified-top-card__job-title',
    '.jobs-unified-top-card__job-title h1',
    '.jobs-unified-top-card__job-title',
    'h1.t-24',
    'h1[class*="job-title"]',
    'div[class*="job-title"]'
  ];

  const COMPANY_SELECTORS = [
    '.job-details-jobs-unified-top-card__company-name a',
    '.job-details-jobs-unified-top-card__company-name',
    '.jobs-unified-top-card__company-name a',
    '.jobs-unified-top-card__company-name',
    'a[class*="company-name"]',
    'div[class*="company-name"]'
  ];

  const LOCATION_SELECTORS = [
    '.job-details-jobs-unified-top-card__primary-description-container',
    '.job-details-jobs-unified-top-card__bullet',
    '.jobs-unified-top-card__bullet',
    'span[class*="workplace-type"]',
    'span[class*="bullet"]'
  ];

  const DESCRIPTION_SELECTORS = [
    '.jobs-description__content .jobs-box__html-content',
    '#job-details',
    '.jobs-description__container',
    '[class*="jobs-description"]'
  ];

  const INJECT_ANCHOR_SELECTORS = [
    '.jobs-apply-button--top-card',
    '.jobs-s-apply',
    '[class*="apply-button"]',
    '[class*="jobs-apply"]'
  ];

  function queryFirst(selectors, root = document) {
    for (const sel of selectors) {
      const el = root.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  // ─── Find anchor to inject button next to ─────────────────────────────────
  // On /jobs/collections/ pages: uses class-based selectors (Apply button area)
  // On /jobs/view/ pages: LinkedIn uses hashed classes, so we find Save button by text
  function findAnchorEl() {
    // Try class-based first (works on list/collection pages)
    const byClass = queryFirst(INJECT_ANCHOR_SELECTORS);
    if (byClass) return { el: byClass, mode: 'after' };

    // Fallback: find Save/Saved button by visible text for /jobs/view/ pages
    for (const btn of document.querySelectorAll('button')) {
      const txt = btn.innerText?.trim().toLowerCase();
      if (txt === 'save' || txt === 'saved') {
        // Return the button's parent so we insert after it at the same level
        return { el: btn.parentElement || btn, mode: 'after' };
      }
    }
    return null;
  }

  function findJobTitleEl() {
    return queryFirst(JOB_TITLE_SELECTORS) || document.querySelector('h1');
  }

  function findCompanyEl() {
    const bySelector = queryFirst(COMPANY_SELECTORS);
    if (bySelector) return bySelector;
    const h1 = document.querySelector('h1');
    if (h1) {
      const parent = h1.closest('div, section');
      if (parent) {
        const anchor = parent.querySelector('a[href*="/company/"]');
        if (anchor) return anchor;
      }
    }
    return null;
  }

  function findDescriptionEl() {
    const bySelector = queryFirst(DESCRIPTION_SELECTORS);
    if (bySelector) return bySelector;
    let best = null, bestLen = 0;
    for (const el of document.querySelectorAll('article, section, div')) {
      if (['NAV','HEADER','FOOTER'].includes(el.tagName)) continue;
      if (el.querySelector('nav, header')) continue;
      const len = (el.innerText || '').trim().length;
      const childBlocks = el.querySelectorAll('article, section').length;
      if (len > bestLen && len < 50000 && childBlocks === 0) {
        bestLen = len;
        best = el;
      }
    }
    return best;
  }

  function extractDescription() {
    const descEl = findDescriptionEl();
    if (!descEl) return null;
    const clone = descEl.cloneNode(true);
    clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    clone.querySelectorAll('li').forEach(li => { li.prepend('• '); li.append('\n'); });
    clone.querySelectorAll('p, h1, h2, h3, h4, h5, h6, div').forEach(el => el.append('\n'));
    return (clone.innerText || clone.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
  }

  function buildClipboardText() {
    const title       = findJobTitleEl()?.innerText?.trim()                || 'Job Title Not Found';
    const company     = findCompanyEl()?.innerText?.trim()                 || 'Company Not Found';
    const location    = queryFirst(LOCATION_SELECTORS)?.innerText?.trim() || '';
    const description = extractDescription();
    let text = `JOB TITLE: ${title}\n`;
    text += `COMPANY: ${company}\n`;
    if (location) text += `LOCATION: ${location}\n`;
    text += `URL: ${window.location.href}\n`;
    text += `\n${'─'.repeat(60)}\n\n`;
    text += description || 'Description not found.';
    return text;
  }

  function showToast(message, type = 'success') {
    let toast = document.getElementById(TOAST_ID);
    if (toast) toast.remove();
    toast = document.createElement('div');
    toast.id = TOAST_ID;
    toast.className = `ljc-toast ljc-toast--${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✓' : '✕'}</span> ${message}`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('ljc-toast--visible')));
    setTimeout(() => {
      toast.classList.remove('ljc-toast--visible');
      setTimeout(() => toast.remove(), 400);
    }, 2500);
  }

  async function copyToClipboard(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
        return true;
      } catch { return false; }
    }
  }

  async function handleCopyClick(btn) {
    btn.disabled = true;
    btn.textContent = 'Copying…';
    const success = await copyToClipboard(buildClipboardText());
    if (success) {
      btn.textContent = '✓ Copied!';
      btn.classList.add('ljc-btn--success');
      showToast('Job description copied to clipboard!');
    } else {
      btn.textContent = '✕ Failed';
      btn.classList.add('ljc-btn--error');
      showToast('Copy failed — try again', 'error');
    }
    setTimeout(() => {
      btn.textContent = '📋 Copy Job Description';
      btn.disabled = false;
      btn.classList.remove('ljc-btn--success', 'ljc-btn--error');
    }, 2000);
  }

  function injectButton() {
    const existing = document.getElementById(BUTTON_ID);
    const anchor   = findAnchorEl();

    if (existing) {
      if (!anchor || !document.body.contains(existing)) existing.remove();
      else return;
    }
    if (!anchor) return;

    const btn = document.createElement('button');
    btn.id        = BUTTON_ID;
    btn.className = 'ljc-btn';
    btn.textContent = '📋 Copy Job Description';
    btn.title = 'Copy full job description to clipboard';
    btn.addEventListener('click', () => handleCopyClick(btn));

    anchor.el.insertAdjacentElement('afterend', btn);
  }

  // ─── SPA navigation ────────────────────────────────────────────────────────
  let lastUrl = location.href;
  function onUrlChange() {
    const current = location.href;
    if (current !== lastUrl) {
      lastUrl = current;
      const old = document.getElementById(BUTTON_ID);
      if (old) old.remove();
      [800, 1500, 2500, 4000].forEach(d => setTimeout(injectButton, d));
    }
  }
  const _push = history.pushState.bind(history);
  history.pushState = function (...a) { _push(...a); onUrlChange(); };
  const _replace = history.replaceState.bind(history);
  history.replaceState = function (...a) { _replace(...a); onUrlChange(); };
  window.addEventListener('popstate', onUrlChange);

  let debounceTimer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(injectButton, 600);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  [1000, 2000, 3500].forEach(d => setTimeout(injectButton, d));

  // ─── Message listener ──────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'scrapeCurrentJobV2') {
      sendResponse({
        title:       findJobTitleEl()?.innerText?.trim()                || 'N/A',
        company:     findCompanyEl()?.innerText?.trim()                 || 'N/A',
        location:    queryFirst(LOCATION_SELECTORS)?.innerText?.trim() || 'N/A',
        url:         window.location.href,
        description: extractDescription() || '',
        fullText:    buildClipboardText()
      });
    }
    if (msg.action === 'scrapeJobCardsV2') {
      sendResponse({ jobs: scrapeJobList() });
    }
    if (msg.action === 'startBulkExtractV2') sendResponse(startBulkExtract());
    if (msg.action === 'bulkStatusV2') sendResponse(bulkStatus());
    if (msg.action === 'cancelBulkV2') {
      if (bulkRun?.state === 'running') bulkRun.state = 'cancelled';
      sendResponse(bulkStatus());
    }
    return true;
  });

  // ─── Scrape job list ───────────────────────────────────────────────────────
  function scrapeJobList() {
    const cardsById = new Map();
    for (const card of document.querySelectorAll('[componentkey^="job-card-component-ref-"]')) {
      const match = /^job-card-component-ref-(\d+)$/.exec(card.getAttribute('componentkey') || '');
      if (!match) continue;
      const jobId = match[1];
      if (!cardsById.has(jobId)) cardsById.set(jobId, []);
      cardsById.get(jobId).push(card);
    }

    return [...cardsById].map(([jobId, elements]) => {
      // LinkedIn can put the key on a nested element while the company and
      // location are siblings. Climb to its card container, stopping before
      // the parent would include a different job's component key.
      const cards = [...new Set(elements.map(el => cardRootForId(el, jobId)))];
      const jobLink = cards.flatMap(card => [
        ...(card.matches('a[href*="/jobs/view/"]') ? [card] : []),
        ...card.querySelectorAll('a[href*="/jobs/view/"]')
      ])
        .find(link => jobUrlForId(link.getAttribute('href'), jobId));
      const title = firstCardText(cards, ['[data-testid*="job-title"]'])
        || firstLine(jobLink?.querySelector('h3')?.innerText)
        || firstLine(jobLink?.querySelector('h4')?.innerText)
        || firstLine(jobLink?.innerText)
        || jobLink?.getAttribute('aria-label')?.trim()
        || firstCardText(cards, ['h3', 'h4']);
      const company = firstCardText(cards, [
        'a[href*="/company/"]',
        '[data-testid*="company"]',
        '[aria-label^="Company:"]'
      ]);
      const location = firstCardText(cards, [
        '[data-testid*="location"]',
        '[itemprop="jobLocation"]',
        '[aria-label^="Location:"]'
      ]);
      const lines = cards.flatMap(card => (card.innerText || '').split('\n').map(line => line.trim()).filter(Boolean));
      const titleIndex = lines.indexOf(title);
      const following = titleIndex >= 0 ? lines.slice(titleIndex + 1) : [];
      const cardCompany = company || following[0] || '';
      const companyIndex = following.indexOf(cardCompany);
      const about = document.getElementById(`JobDetails_AboutTheJob_${jobId}`)
        ?.querySelector('[data-testid="expandable-text-box"]')?.innerText?.trim() || '';

      return {
        jobId,
        title: title || `Job #${jobId}`,
        company: cardCompany,
        location: location || (companyIndex >= 0 ? following[companyIndex + 1] : '') || '',
        jobUrl: jobUrlForId(jobLink?.getAttribute('href'), jobId) || `https://www.linkedin.com/jobs/view/${jobId}/`,
        aboutTheJob: about
      };
    });
  }

  function cardRootForId(element, jobId) {
    let root = element;
    while (root.parentElement && root.parentElement !== document.body) {
      const parent = root.parentElement;
      const containsAnotherJob = [...parent.querySelectorAll('[componentkey^="job-card-component-ref-"]')]
        .some(el => {
          const match = /^job-card-component-ref-(\d+)$/.exec(el.getAttribute('componentkey') || '');
          return match && match[1] !== jobId;
        });
      if (containsAnotherJob) break;
      root = parent;
      if (root.matches('li') || root.matches('[role="listitem"]')) break;
    }
    return root;
  }

  function firstLine(value) {
    return (value || '').split('\n').map(line => line.trim()).find(Boolean) || '';
  }

  function firstCardText(cards, selectors) {
    for (const selector of selectors) {
      for (const card of cards) {
        const el = card.querySelector(selector);
        const value = firstLine(el?.innerText) || el?.getAttribute('aria-label')?.replace(/^[^:]+:\s*/, '').trim();
        if (value) return value;
      }
    }
    return '';
  }

  function jobUrlForId(href, jobId) {
    if (!href) return '';
    try {
      const url = new URL(href, 'https://www.linkedin.com');
      return url.protocol === 'https:' && (url.hostname === 'linkedin.com' || url.hostname.endsWith('.linkedin.com'))
        && url.pathname.match(/^\/jobs\/view\/(\d+)\/?$/)?.[1] === jobId
        ? `${url.origin}/jobs/view/${jobId}/` : '';
    } catch { return ''; }
  }

  // ─── Bulk job details ──────────────────────────────────────────────────────
  // Search-result cards often lack readable text, so each job's title, company,
  // location and description come from LinkedIn's public job-posting endpoint.
  // This runs in the page rather than the popup so closing the popup does not
  // stop it; the popup polls bulkStatus().
  const DETAIL_CONCURRENCY = 3;
  const DETAIL_TIMEOUT_MS  = 10000;
  const DETAIL_RETRIES     = 3;
  let bulkRun = null;

  function bulkStatus() {
    if (!bulkRun) return { state: 'idle' };
    const { state, done, jobs, failures } = bulkRun;
    return { state, done, total: jobs.length, jobs, failures: [...failures] };
  }

  function startBulkExtract() {
    if (bulkRun?.state === 'running') return bulkStatus();
    const run = { state: 'running', done: 0, jobs: scrapeJobList(), failures: [] };
    bulkRun = run;
    fillJobDetails(run).then(() => { if (run.state === 'running') run.state = 'done'; });
    return bulkStatus();
  }

  async function fillJobDetails(run) {
    let next = 0;
    async function worker() {
      while (run.state === 'running' && next < run.jobs.length) {
        const job = run.jobs[next++];
        try {
          const fields = await fetchJobDetails(job.jobId, run);
          job.title    = fields.title    || job.title;
          job.company  = fields.company  || job.company;
          job.location = fields.location || job.location;
          if (fields.aboutTheJob.length > job.aboutTheJob.length) job.aboutTheJob = fields.aboutTheJob;
        } catch (error) {
          if (run.state === 'running') run.failures.push(`${job.jobId}: ${error.message || 'Request failed'}`);
        }
        run.done++;
      }
    }
    await Promise.all(Array.from({ length: Math.min(DETAIL_CONCURRENCY, run.jobs.length) }, worker));
  }

  async function fetchJobDetails(jobId, run) {
    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const deadline = setTimeout(() => controller.abort(), DETAIL_TIMEOUT_MS);
      try {
        const response = await fetch(`${location.origin}/jobs-guest/jobs/api/jobPosting/${jobId}`, {
          credentials: 'omit', signal: controller.signal
        });
        if (response.status === 429 && attempt < DETAIL_RETRIES && run.state === 'running') {
          await new Promise(resolve => setTimeout(resolve, 2000 * 2 ** attempt));
          continue;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        // Collapse source-formatting whitespace so only <br>/block breaks remain.
        const html = (await response.text()).replace(/\s+/g, ' ');
        const fields = parseJobDetails(new DOMParser().parseFromString(html, 'text/html'));
        if (!fields.title && !fields.aboutTheJob) throw new Error('No job details in response');
        return fields;
      } catch (error) {
        throw error.name === 'AbortError' ? new Error('Timed out') : error;
      } finally {
        clearTimeout(deadline);
      }
    }
  }

  function parseJobDetails(doc) {
    const text = selector => doc.querySelector(selector)?.textContent.replace(/\s+/g, ' ').trim() || '';
    return {
      title:       text('.top-card-layout__title'),
      company:     text('.topcard__org-name-link'),
      location:    text('.topcard__flavor--bullet:not(.topcard__flavor--metadata)'),
      aboutTheJob: blockText(doc.querySelector('.show-more-less-html__markup'))
    };
  }

  function blockText(element) {
    if (!element) return '';
    const clone = element.cloneNode(true);
    clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    clone.querySelectorAll('li').forEach(li => { li.prepend('• '); li.append('\n'); });
    clone.querySelectorAll('p, ul, ol, h1, h2, h3, h4, h5, h6, div').forEach(block => block.append('\n'));
    return clone.textContent.split('\n').map(line => line.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

})();
