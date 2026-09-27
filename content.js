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
    if (msg.action === 'scrapeJobCardsV2') {
      sendResponse({ jobs: scrapeJobList() });
    }
    if (msg.action === 'pageInfoV2') sendResponse({ currentPage: currentPage() });
    if (msg.action === 'startBulkExtractV2') sendResponse(startBulkExtract(msg.fromPage, msg.toPage));
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

  // ─── Search result pages ───────────────────────────────────────────────────
  // Pages are changed by clicking LinkedIn's own pagination buttons, which
  // swaps the result list in place and keeps this script (and the run) alive.
  const PAGE_LOAD_TIMEOUT_MS = 15000;
  const PAGE_SETTLE_MS       = 1200;
  const PAGE_POLL_MS         = 250;

  function pageButtons() {
    return [...document.querySelectorAll('button[aria-label^="Page "]')]
      .map(button => ({ button, page: Number(/^Page (\d+)$/.exec(button.getAttribute('aria-label') || '')?.[1]) }))
      .filter(entry => entry.page > 0);
  }

  function currentPage() {
    const active = pageButtons().find(({ button }) =>
      ['true', 'page'].includes(button.getAttribute('aria-current'))
      || /(^|\s|-)(active|selected)(\s|$)/.test(`${button.className || ''} ${button.parentElement?.className || ''}`));
    if (active) return active.page;
    const start = Number(new URL(location.href).searchParams.get('start'));
    return start > 0 ? Math.floor(start / 25) + 1 : 1;
  }

  function stepButton(direction) {
    const label = direction === 'next' ? /^(view )?next( page)?$/i : /^(view )?previous( page)?$/i;
    return [...document.querySelectorAll('button')].find(button =>
      label.test((button.getAttribute('aria-label') || button.innerText || '').trim())) || null;
  }

  function cardIdsKey() {
    return scrapeJobList().map(job => job.jobId).join(',');
  }

  async function goToPage(target, run) {
    // Each click moves at least one page, so this bounds the number of hops.
    for (let hops = 0; hops <= target + 100; hops++) {
      const page = currentPage();
      if (page === target) return;
      const button = pageButtons().find(entry => entry.page === target)?.button
        || stepButton(page < target ? 'next' : 'previous');
      if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') {
        throw new Error(`Page ${target} is not available`);
      }
      const before = cardIdsKey();
      button.click();
      await waitForNewCards(before, run);
      if (run.state !== 'running') return;
    }
    throw new Error(`Could not reach page ${target}`);
  }

  // Wait until the result list shows different jobs, then until it stops changing.
  async function waitForNewCards(before, run) {
    const deadline = Date.now() + PAGE_LOAD_TIMEOUT_MS;
    let key = before;
    let stableSince = 0;
    while (run.state === 'running') {
      await new Promise(resolve => setTimeout(resolve, PAGE_POLL_MS));
      const now = cardIdsKey();
      if (now !== key) { key = now; stableSince = Date.now(); }
      if (key && key !== before && Date.now() - stableSince >= PAGE_SETTLE_MS) return;
      if (Date.now() > deadline) {
        if (key && key !== before) return;
        throw new Error('Next page of jobs did not load');
      }
    }
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
    const { state, phase, done, jobs, failures, fromPage, toPage, page, lastPage, notice } = bulkRun;
    return {
      state, phase, done, total: jobs.length, jobs, failures: [...failures],
      fromPage, toPage, page, lastPage, notice
    };
  }

  // Without a page range, only the jobs already on screen are read.
  function startBulkExtract(fromPage, toPage) {
    if (bulkRun?.state === 'running') return bulkStatus();
    const ranged = Number.isInteger(fromPage) && Number.isInteger(toPage) && fromPage >= 1 && toPage >= fromPage;
    const run = {
      state: 'running', phase: 'loading', done: 0, jobs: [], failures: [],
      fromPage: ranged ? fromPage : null, toPage: ranged ? toPage : null,
      page: ranged ? fromPage : null, lastPage: null, notice: ''
    };
    bulkRun = run;
    extractPages(run).then(() => { if (run.state === 'running') run.state = 'done'; });
    return bulkStatus();
  }

  async function extractPages(run) {
    const pages = run.fromPage ? run.toPage - run.fromPage + 1 : 1;
    for (let i = 0; i < pages && run.state === 'running'; i++) {
      if (run.fromPage) {
        run.page  = run.fromPage + i;
        run.phase = 'loading';
        try {
          await goToPage(run.page, run);
        } catch (error) {
          if (run.state === 'running') run.notice = error.message;
          return;
        }
        if (run.state !== 'running') return;
      }
      const seen = new Set(run.jobs.map(job => job.jobId));
      const fresh = scrapeJobList().filter(job => !seen.has(job.jobId));
      run.jobs.push(...fresh);
      run.lastPage = run.page;
      run.phase = 'details';
      await fillJobDetails(run, fresh);
    }
  }

  async function fillJobDetails(run, jobs) {
    let next = 0;
    async function worker() {
      while (run.state === 'running' && next < jobs.length) {
        const job = jobs[next++];
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
    await Promise.all(Array.from({ length: Math.min(DETAIL_CONCURRENCY, jobs.length) }, worker));
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
