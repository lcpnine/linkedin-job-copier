// LinkedIn Job Copier — Popup Logic
document.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);

  const statusDot      = $('statusDot');
  const notLinkedIn    = $('notLinkedIn');
  const mainContent    = $('mainContent');
  const currentCard    = $('currentJobCard');
  const copyCurrentBtn = $('copyCurrentBtn');
  const copyMinimalBtn = $('copyMinimalBtn');
  const scrapeListBtn  = $('scrapeListBtn');
  const jobList        = $('jobList');
  const jobListState   = $('jobListState');
  const extractionResult = $('extractionResult');
  const listActions    = $('listActions');
  const copyAllBtn     = $('copyAllBtn');
  const exportCsvBtn   = $('exportCsvBtn');
  $('extensionVersion').textContent = `v${chrome.runtime.getManifest().version}`;

  let currentJob   = null;
  let scrapedJobs  = [];

  // ─── Get active tab ────────────────────────────────────────────────────────
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isLinkedIn = tab?.url?.includes('linkedin.com/jobs');

  if (!isLinkedIn) {
    statusDot.textContent = 'not on LinkedIn Jobs';
    statusDot.className   = 'status-dot status-dot--not-job';
    notLinkedIn.hidden    = false;
    return;
  }

  mainContent.hidden = false;

  loadCurrentJob();
  resumeBulk();

  // ─── Load current job ──────────────────────────────────────────────────────
  async function loadCurrentJob() {
    try {
      const resp = await sendToPage({ action: 'scrapeCurrentJobV2' });
      if (resp && resp.title && resp.title !== 'N/A') {
        currentJob = resp;
        renderCurrentJob(resp);
        statusDot.textContent   = 'ready';
        statusDot.className     = 'status-dot status-dot--ready';
        copyCurrentBtn.disabled = false;
        copyMinimalBtn.disabled = false;
      } else {
        currentCard.innerHTML   = `<p class="job-card__loading" style="color:#8b949e">No job selected — click a job listing first.</p>`;
        statusDot.textContent   = 'no job selected';
        statusDot.className     = 'status-dot status-dot--not-job';
      }
    } catch (e) {
      currentCard.textContent = `Could not read page: ${e.message}`;
    }
  }

  // ─── Render current job card ───────────────────────────────────────────────
  function renderCurrentJob(job) {
    const preview = job.description
      ? job.description.slice(0, 200) + (job.description.length > 200 ? '…' : '')
      : 'No description found';
    currentCard.innerHTML = `
      <div class="job-card__title">${escHtml(job.title)}</div>
      <div class="job-card__company">${escHtml(job.company)}</div>
      ${job.location ? `<div class="job-card__location">${escHtml(job.location)}</div>` : ''}
      <div class="job-card__desc-preview">${escHtml(preview)}</div>
    `;
  }

  // ─── Copy current job ──────────────────────────────────────────────────────
  copyCurrentBtn.addEventListener('click', async () => {
    if (!currentJob) return;
    await clipboardWrite(currentJob.fullText);
    flashBtn(copyCurrentBtn, '✓ Copied!');
  });

  copyMinimalBtn.addEventListener('click', async () => {
    if (!currentJob) return;
    const summary = [
      `Title: ${currentJob.title}`,
      `Company: ${currentJob.company}`,
      currentJob.location ? `Location: ${currentJob.location}` : '',
      `URL: ${currentJob.url}`
    ].filter(Boolean).join('\n');
    await clipboardWrite(summary);
    flashBtn(copyMinimalBtn, '✓ Copied!');
  });

  // ─── Extract visible jobs, then read each job's details ───────────────────
  // The run lives in the content script, so reopening the popup resumes it.
  let following = false;

  scrapeListBtn.addEventListener('click', async () => {
    if (following) {
      scrapeListBtn.disabled = true;
      try { await sendMessage(tab.id, { action: 'cancelBulkV2' }); } catch (_) {}
      return;
    }
    try {
      await followBulk(await sendToPage({ action: 'startBulkExtractV2' }));
    } catch (e) {
      showBulkError(e);
    }
  });

  async function resumeBulk() {
    try {
      const status = await sendToPage({ action: 'bulkStatusV2' });
      if (status && status.state !== 'idle') await followBulk(status);
    } catch (_) {}
  }

  async function followBulk(status) {
    following = true;
    scrapeListBtn.textContent = 'Stop';
    scrapeListBtn.disabled    = false;
    extractionResult.hidden   = false;
    try {
      while (status.state === 'running') {
        extractionResult.textContent = `Found ${status.total} jobs. Reading details ${status.done}/${status.total}…`;
        await new Promise(resolve => setTimeout(resolve, 700));
        status = await withTimeout(sendMessage(tab.id, { action: 'bulkStatusV2' }), 10000, 'LinkedIn page did not respond');
      }
      showBulkResult(status);
    } catch (e) {
      showBulkError(e);
    } finally {
      following = false;
      scrapeListBtn.textContent = 'Extract Visible Jobs';
      scrapeListBtn.disabled    = false;
    }
  }

  function showBulkResult(status) {
    scrapedJobs = status.jobs || [];
    const descriptions = scrapedJobs.filter(job => job.aboutTheJob).length;
    const failures = status.failures || [];
    extractionResult.textContent = `Extracted ${scrapedJobs.length} unique jobs, ${descriptions} with job descriptions.`
      + (status.state === 'cancelled' ? ' Stopped early.' : '')
      + (failures.length ? ` ${failures.length} could not be read (${failures[0]}).` : '');
    extractionResult.hidden = false;
    if (scrapedJobs.length === 0) {
      jobListState.textContent = "No job cards found. Make sure you're on a job search results page.";
      jobListState.hidden = false;
      jobList.hidden      = true;
      listActions.hidden  = true;
    } else {
      jobListState.hidden = true;
      jobList.hidden      = false;
      listActions.hidden  = false;
      renderJobList(scrapedJobs);
    }
  }

  function showBulkError(e) {
    scrapedJobs = [];
    extractionResult.hidden = true;
    jobListState.textContent = `Error extracting jobs: ${e.message || 'Try refreshing the page.'}`;
    jobListState.hidden = false;
    jobList.hidden = true;
    listActions.hidden = true;
  }

  // ─── Render job list ───────────────────────────────────────────────────────
  function renderJobList(jobs) {
    jobList.innerHTML = '';   // ✅ always clear first

    jobs.forEach((job, i) => {
      const item = document.createElement('div');
      item.className = 'job-list-item';
      item.innerHTML = `
        <span class="job-list-item__num">${i + 1}</span>
        <div class="job-list-item__info">
          <div class="job-list-item__title">${escHtml(job.title || 'Untitled')}</div>
          <div class="job-list-item__meta">${escHtml(job.company)}${job.location ? ' · ' + escHtml(job.location) : ''}</div>
        </div>
        <button class="job-list-item__copy" data-idx="${i}">Copy</button>
      `;

      item.querySelector('.job-list-item__copy').addEventListener('click', async e => {
        e.stopPropagation();
        const j    = scrapedJobs[i];
        const text = `Title: ${j.title}\nCompany: ${j.company}${j.location ? '\nLocation: ' + j.location : ''}\nURL: ${j.jobUrl}`;
        await clipboardWrite(text);
        const btn = e.target;
        btn.textContent = '✓';
        setTimeout(() => btn.textContent = 'Copy', 1500);
      });

      item.addEventListener('click', () => {
        if (job.jobUrl) chrome.tabs.update(tab.id, { url: job.jobUrl });
      });

      jobList.appendChild(item);
    });
  }

  // ─── Copy all ──────────────────────────────────────────────────────────────
  copyAllBtn.addEventListener('click', async () => {
    if (!scrapedJobs.length) return;
    const text = scrapedJobs.map((j, i) =>
      `${i + 1}. ${j.title}\nCompany: ${j.company}${j.location ? '\nLocation: ' + j.location : ''}\nURL: ${j.jobUrl}`
        + (j.aboutTheJob ? `\n\n${j.aboutTheJob}` : '')
    ).join(`\n\n${'─'.repeat(50)}\n\n`);
    const full = `LinkedIn Jobs Export — ${new Date().toLocaleDateString()}\n${'─'.repeat(50)}\n\n${text}`;
    await clipboardWrite(full);
    flashBtn(copyAllBtn, '✓ Copied All!');
  });

  // ─── Export CSV ────────────────────────────────────────────────────────────
  exportCsvBtn.addEventListener('click', () => {
    if (!scrapedJobs.length) return;
    const headers = ['jobId', 'title', 'company', 'location', 'jobUrl', 'aboutTheJob'];
    const rows = scrapedJobs.map(job => headers.map(field => csvEscape(job[field])));
    const csv  = [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `linkedin-jobs-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // ─── Helpers ───────────────────────────────────────────────────────────────
  async function sendToPage(msg) {
    try {
      await withTimeout(
        chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }),
        10000, 'Content script injection timed out'
      );
    } catch (error) {
      throw new Error(`Content script injection failed: ${error.message}`);
    }
    return withTimeout(sendMessage(tab.id, msg), 10000, 'LinkedIn page did not respond');
  }

  function withTimeout(promise, ms, message) {
    return new Promise((resolve, reject) => {
      const deadline = setTimeout(() => reject(new Error(message)), ms);
      Promise.resolve(promise).then(
        value => { clearTimeout(deadline); resolve(value); },
        error => { clearTimeout(deadline); reject(error); }
      );
    });
  }

  function sendMessage(tabId, msg) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, msg, resp => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(resp);
      });
    });
  }

  async function clipboardWrite(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
  }

  function flashBtn(btn, msg) {
    const orig = btn.textContent;
    btn.textContent = msg;
    btn.classList.add('btn--flashed');
    setTimeout(() => {
      btn.textContent = orig;
      btn.classList.remove('btn--flashed');
    }, 1800);
  }

  function escHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function csvEscape(str) {
    return `"${String(str ?? '').replace(/"/g, '""')}"`;
  }

});
