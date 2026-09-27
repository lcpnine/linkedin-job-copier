const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function element(tag, attrs = {}, text = '', children = [], onClick) {
  const node = {
    tagName: tag.toUpperCase(), attrs, text, children, className: attrs.class || '', disabled: false,
    click() { onClick?.(); },
    get innerText() { return this.text || this.children.map(child => child.innerText).filter(Boolean).join('\n'); },
    get textContent() { return this.text || this.children.map(child => child.textContent).join(''); },
    get nextElementSibling() {
      const siblings = this.parentElement?.children || [];
      return siblings[siblings.indexOf(this) + 1] || null;
    },
    getAttribute(name) { return this.attrs[name] ?? null; },
    closest(selector) {
      for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node;
      return null;
    },
    contains(other) { return this.children.some(child => child === other || child.contains(other)); },
    matches(selector) {
      const match = /^(\w+)?(?:\[([\w-]+)(\^=|\*=|=)"([^"]*)"\])?$/.exec(selector);
      if (!match) throw new Error(`Unsupported fixture selector: ${selector}`);
      const [, tagName, attr, operator, value] = match;
      if (tagName && this.tagName !== tagName.toUpperCase()) return false;
      if (!attr) return true;
      const actual = this.getAttribute(attr);
      return actual !== null && (operator === '=' ? actual === value
        : operator === '^=' ? actual.startsWith(value) : actual.includes(value));
    },
    querySelectorAll(selector) {
      return this.children.flatMap(child => [
        ...(child.matches(selector) ? [child] : []),
        ...child.querySelectorAll(selector)
      ]);
    },
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  };
  for (const child of children) child.parentElement = node;
  return node;
}

function detailDocument(html) {
  const id = html.trim();
  const fields = {
    4463260097: { title: 'Backend Engineer', company: 'IKEA', location: 'Amsterdam', about: 'Line 1, "quoted"\nLine 2\nFull ending' },
    4463260098: { title: 'Designer II', company: 'Beta', location: 'London', about: 'Public line 1\nPublic line 2' },
    4463260099: { title: 'Data Engineer', company: 'Gamma', location: 'Berlin', about: 'Page two job' }
  }[id];
  const nodes = {
    '.top-card-layout__title': fields.title,
    '.topcard__org-name-link': ` ${fields.company} `,
    '.topcard__flavor--bullet:not(.topcard__flavor--metadata)': fields.location
  };
  return {
    querySelector(selector) {
      if (selector === '.show-more-less-html__markup') {
        return { cloneNode: () => ({ querySelectorAll: () => [], textContent: fields.about }) };
      }
      return selector in nodes ? { textContent: nodes[selector] } : null;
    }
  };
}

function contentFixture({ fetch, paginated = false } = {}) {
  const duplicate = element('div', { componentkey: 'job-card-component-ref-4463260097' }, '', [
    element('span', {}, 'Nested duplicate')
  ]);
  const first = element('article', {}, '', [
    element('a', { href: '/jobs/view/123/' }, 'Wrong job'),
    element('div', { componentkey: 'job-card-component-ref-4463260097' }, '', [
      element('a', { href: '/jobs/view/4463260097/?tracking=abc' }, '', [
        element('h3', {}, 'Engineer, "Platform"')
      ]),
      duplicate
    ]),
    element('a', { href: '/company/acme/' }, 'Acme, Inc.'),
    element('span', { 'data-testid': 'job-card-location' }, 'Singapore')
  ]);
  const second = element('article', {}, '', [
    element('div', { componentkey: 'job-card-component-ref-4463260098' }, '', [
      element('a', { href: 'https://www.linkedin.com/jobs/view/4463260098/' }, '', [
        element('h4', {}, 'Designer')
      ])
    ]),
    element('div', {}, 'Beta Ltd'),
    element('div', {}, 'Remote')
  ]);
  const invalid = element('article', { componentkey: 'job-card-component-ref-not-a-number' }, 'Ignore');
  const about = element('section', { id: 'JobDetails_AboutTheJob_4463260097' }, '', [
    element('div', { 'data-testid': 'expandable-text-box' }, 'Line 1, "quoted"\nLine 2')
  ]);
  const third = element('article', {}, '', [
    element('div', { componentkey: 'job-card-component-ref-4463260099' }, '', [
      element('a', { href: '/jobs/view/4463260099/' }, '', [element('h3', {}, 'Data Engineer')])
    ])
  ]);
  const secondAgain = element('article', {}, '', [
    element('div', { componentkey: 'job-card-component-ref-4463260098' }, '', [
      element('a', { href: '/jobs/view/4463260098/' }, '', [element('h4', {}, 'Designer')])
    ])
  ]);
  // Two result pages; page 2 repeats one job from page 1.
  const pageCards = { 1: [first, second, invalid], 2: [third, secondAgain] };
  let page = 1;
  let pagination = [];
  const body = element('body', {}, '', []);
  function showPage(next) {
    page = next;
    const pageButton = n => element('button', {
      'aria-label': `Page ${n}`, ...(n === page ? { 'aria-current': 'true' } : {})
    }, String(n), [], () => showPage(n));
    const nextButton = element('button', { 'aria-label': 'View next page' }, 'Next', [], () => showPage(page + 1));
    nextButton.disabled = page === 2;
    pagination = paginated ? [element('div', {}, '', [pageButton(1), pageButton(2), nextButton])] : [];
    body.children = [...pageCards[page], about, ...pagination];
    for (const child of body.children) child.parentElement = body;
  }
  showPage(1);
  const document = {
    body,
    querySelectorAll: selector => body.querySelectorAll(selector),
    querySelector: selector => body.querySelector(selector),
    getElementById: id => [about].find(node => node.getAttribute('id') === id) || null
  };
  let listener;
  let listenerCount = 0;
  let scrolls = 0;
  let navigations = 0;
  let clock = 0;
  const location = { href: 'https://www.linkedin.com/jobs/search/', origin: 'https://www.linkedin.com' };
  const window = {
    __ljcInjected: true, // Simulate a content script left by an older extension build.
    location,
    addEventListener() {},
    scrollTo() { scrolls++; }
  };
  const history = {
    pushState() { navigations++; },
    replaceState() { navigations++; }
  };
  const chrome = { runtime: { onMessage: { addListener(fn) { listener = fn; listenerCount++; } } } };
  const context = {
    document, window, location, history, chrome, URL,
    MutationObserver: class { observe() {} },
    setTimeout() {}, clearTimeout,
    AbortController, fetch,
    // Page-load polling reads the clock; advance it so settling is instant.
    Date: { now: () => (clock += 500) },
    DOMParser: class { parseFromString(html) { return detailDocument(html); } }
  };
  const script = fs.readFileSync(path.join(root, 'content.js'), 'utf8');
  vm.runInNewContext(script, context);
  vm.runInNewContext(script, context);
  // Button-injection timers stay inert; detail backoff and timeouts run fast.
  context.setTimeout = (callback, ms) => ms === 10000 ? setTimeout(callback, 20) : setImmediate(callback);
  const send = (action, extra) => { let response; listener({ action, ...extra }, null, value => { response = value; }); return response; };
  return {
    send,
    async waitForBulk() {
      let status = send('bulkStatusV2');
      while (status.state === 'running') {
        await new Promise(resolve => setTimeout(resolve, 5));
        status = send('bulkStatusV2');
      }
      return status;
    },
    extract() {
      let response;
      listener({ action: 'scrapeJobCardsV2' }, null, value => { response = value; });
      return response.jobs;
    },
    removeFirstCard() { body.children = body.children.filter(child => child !== first); },
    page: () => page,
    listenerCount: () => listenerCount,
    effects: () => ({ scrolls, navigations })
  };
}

test('current DOM extraction deduplicates IDs and reads card fields and selected About text', () => {
  const fixture = contentFixture();
  const jobs = fixture.extract();
  assert.equal(fixture.listenerCount(), 1);
  assert.equal(jobs.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(jobs)), [
    {
      jobId: '4463260097', title: 'Engineer, "Platform"', company: 'Acme, Inc.',
      location: 'Singapore', jobUrl: 'https://www.linkedin.com/jobs/view/4463260097/',
      aboutTheJob: 'Line 1, "quoted"\nLine 2'
    },
    {
      jobId: '4463260098', title: 'Designer', company: 'Beta Ltd',
      location: 'Remote', jobUrl: 'https://www.linkedin.com/jobs/view/4463260098/',
      aboutTheJob: ''
    }
  ]);
  assert.deepEqual(fixture.effects(), { scrolls: 0, navigations: 0 });
  fixture.removeFirstCard();
  assert.deepEqual([...fixture.extract()].map(job => job.jobId), ['4463260098']);
});

test('bulk extraction fills card data from each job detail page, retrying rate limits', async () => {
  const calls = [];
  const fixture = contentFixture({
    fetch: async (url, options) => {
      calls.push(url);
      assert.equal(options.credentials, 'omit');
      const id = url.match(/\/jobs-guest\/jobs\/api\/jobPosting\/(\d+)$/)[1];
      if (id === '4463260097' && calls.filter(call => call === url).length === 1) return { ok: false, status: 429 };
      if (id === '4463260098') return { ok: false, status: 500 };
      return { ok: true, status: 200, text: async () => `\n  ${id}\n` };
    }
  });
  const started = fixture.send('startBulkExtractV2');
  assert.equal(started.state, 'running');
  await new Promise(setImmediate);
  assert.equal(fixture.send('startBulkExtractV2').total, 2, 'a second start joins the running extraction');
  const status = await fixture.waitForBulk();
  assert.equal(status.state, 'done');
  assert.equal(status.done, 2);
  assert.deepEqual([...status.failures], ['4463260098: HTTP 500']);
  assert.equal(calls.length, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(status.jobs)), [
    {
      jobId: '4463260097', title: 'Backend Engineer', company: 'IKEA',
      location: 'Amsterdam', jobUrl: 'https://www.linkedin.com/jobs/view/4463260097/',
      aboutTheJob: 'Line 1, "quoted"\nLine 2\nFull ending'
    },
    {
      jobId: '4463260098', title: 'Designer', company: 'Beta Ltd',
      location: 'Remote', jobUrl: 'https://www.linkedin.com/jobs/view/4463260098/',
      aboutTheJob: ''
    }
  ]);
  assert.deepEqual(fixture.effects(), { scrolls: 0, navigations: 0 });
});

test('bulk extraction can be stopped and times out hung requests', async () => {
  const fixture = contentFixture({
    fetch: (_url, options) => new Promise((_, reject) => options.signal.addEventListener('abort', () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    }))
  });
  fixture.send('startBulkExtractV2');
  const timedOut = await fixture.waitForBulk();
  assert.equal(timedOut.state, 'done');
  assert.deepEqual([...timedOut.failures], ['4463260097: Timed out', '4463260098: Timed out']);

  fixture.send('startBulkExtractV2');
  assert.equal(fixture.send('cancelBulkV2').state, 'cancelled');
  const cancelled = await fixture.waitForBulk();
  assert.equal(cancelled.state, 'cancelled');
  assert.deepEqual([...cancelled.failures], []);
  assert.equal(cancelled.jobs.length, 2);
});

test('page-range extraction clicks through each page and stops at the last one', async () => {
  const fetched = [];
  const fixture = contentFixture({
    paginated: true,
    fetch: async url => {
      const id = url.match(/(\d+)$/)[1];
      fetched.push(id);
      return { ok: true, status: 200, text: async () => id };
    }
  });
  assert.equal(fixture.send('pageInfoV2').currentPage, 1);
  fixture.send('startBulkExtractV2', { fromPage: 1, toPage: 3 });
  const status = await fixture.waitForBulk();
  assert.equal(status.state, 'done');
  assert.equal(fixture.page(), 2);
  assert.equal(status.lastPage, 2);
  assert.equal(status.notice, 'Page 3 is not available');
  assert.deepEqual([...status.jobs].map(job => job.jobId), ['4463260097', '4463260098', '4463260099']);
  assert.deepEqual(fetched, ['4463260097', '4463260098', '4463260099'], 'repeated jobs are fetched once');
  assert.equal(status.jobs[2].title, 'Data Engineer');

  fixture.send('startBulkExtractV2', { fromPage: 1, toPage: 1 });
  const back = await fixture.waitForBulk();
  assert.equal(fixture.page(), 1, 'navigates back to the first requested page');
  assert.deepEqual([...back.jobs].map(job => job.jobId), ['4463260097', '4463260098']);
  assert.equal(back.notice, '');
});

test('popup extracts the entered page range, shows progress, and exports escaped six-column CSV', async () => {
  const jobs = contentFixture().extract();
  jobs[1].aboutTheJob = 'Public line 1\nPublic line 2';
  const ids = [
    'statusDot', 'notLinkedIn', 'mainContent', 'pageRangeForm', 'fromPageInput',
    'toPageInput', 'scrapeListBtn', 'jobList', 'jobListState',
    'extractionResult', 'listActions', 'copyAllBtn', 'exportCsvBtn', 'extensionVersion'
  ];
  const elements = Object.fromEntries(ids.map(id => [id, {
    hidden: false, textContent: '', innerHTML: '', listeners: {}, children: [],
    addEventListener(type, callback) { this.listeners[type] = callback; },
    querySelector() { return { addEventListener() {} }; },
    appendChild(child) { this.children.push(child); },
    click() { return this.listeners.click?.(); },
    submit() { return this.listeners.submit?.({ preventDefault() {} }); }
  }]));
  let domReady;
  let downloaded;
  let scrolls = 0;
  let navigations = 0;
  let fetchCalls = 0;
  let injectionShouldFail = false;
  const messages = [];
  const progressSeen = [];
  let bulkState = 'idle';
  const document = {
    addEventListener(type, callback) { if (type === 'DOMContentLoaded') domReady = callback; },
    getElementById(id) { return elements[id]; },
    createElement(tag) {
      if (tag === 'a') return { click() {} };
      return { innerHTML: '', querySelector: () => ({ addEventListener() {} }), addEventListener() {} };
    }
  };
  const chrome = {
    tabs: {
      query: async () => [{ id: 7, url: 'https://www.linkedin.com/jobs/search/' }],
      sendMessage(_id, message, callback) {
        messages.push(message.action);
        const copy = () => JSON.parse(JSON.stringify(jobs));
        const range = { fromPage: 2, toPage: 4 };
        if (message.action === 'pageInfoV2') return callback({ currentPage: 2 });
        if (message.action === 'startBulkExtractV2') {
          assert.deepEqual([message.fromPage, message.toPage], [2, 3]);
          bulkState = 'running';
          return callback({ state: 'running', phase: 'details', done: 0, total: 2, jobs: copy(), failures: [], ...range, page: 2 });
        }
        if (message.action === 'bulkStatusV2') {
          if (bulkState === 'idle') return callback({ state: 'idle' });
          progressSeen.push(elements.extractionResult.textContent);
          return callback({
            state: 'done', done: 2, total: 2, jobs: copy(), failures: ['4463260098: HTTP 429'],
            ...range, page: 3, lastPage: 3, notice: 'Page 4 is not available'
          });
        }
        callback({ title: 'N/A' });
      },
      update() { navigations++; }
    },
    scripting: { executeScript: async () => {
      if (injectionShouldFail) throw new Error('site access denied');
    } },
    runtime: { lastError: null, getManifest: () => ({ version: '1.1.0' }) }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'popup.js'), 'utf8'), {
    document, chrome, Blob, navigator: { clipboard: { writeText: async () => {} } },
    URL: { createObjectURL(blob) { downloaded = blob; return 'blob:test'; }, revokeObjectURL() {} },
    setTimeout: (callback, ms) => setTimeout(callback, ms === 700 ? 0 : ms), clearTimeout,
    window: { scrollTo() { scrolls++; } },
    fetch: async url => { fetchCalls++; throw new Error(`unexpected fetch ${url}`); },
    Date
  });
  await domReady();
  await new Promise(setImmediate);
  assert.equal(elements.extensionVersion.textContent, 'v1.1.0');
  assert.deepEqual(messages.sort(), ['bulkStatusV2', 'pageInfoV2']);
  assert.deepEqual([elements.fromPageInput.value, elements.toPageInput.value], ['2', '2']);
  messages.length = 0;
  elements.toPageInput.value = '3';
  await elements.pageRangeForm.submit();
  assert.deepEqual(messages, ['startBulkExtractV2', 'bulkStatusV2']);
  assert.deepEqual(progressSeen, ['Page 2 of 2–4: reading details 0/2… (2 jobs found)']);
  assert.equal(elements.extractionResult.textContent,
    'Extracted 2 unique jobs from pages 2–3, 2 with job descriptions. Page 4 is not available.'
    + ' 1 could not be read (4463260098: HTTP 429).');
  assert.equal(elements.scrapeListBtn.textContent, 'Extract Jobs');
  assert.equal(elements.fromPageInput.disabled, false);
  assert.deepEqual({ scrolls, navigations, fetchCalls }, { scrolls: 0, navigations: 0, fetchCalls: 0 });

  elements.exportCsvBtn.click();
  assert.equal(await downloaded.text(), [
    'jobId,title,company,location,jobUrl,aboutTheJob',
    '"4463260097","Engineer, ""Platform""","Acme, Inc.","Singapore","https://www.linkedin.com/jobs/view/4463260097/","Line 1, ""quoted""\nLine 2"',
    '"4463260098","Designer","Beta Ltd","Remote","https://www.linkedin.com/jobs/view/4463260098/","Public line 1\nPublic line 2"'
  ].join('\r\n'));

  elements.toPageInput.value = '1';
  await elements.pageRangeForm.submit();
  assert.equal(elements.extractionResult.textContent, 'Enter a valid page range, e.g. 1 to 5.');

  injectionShouldFail = true;
  elements.toPageInput.value = '3';
  await elements.pageRangeForm.submit();
  assert.equal(elements.jobListState.textContent,
    'Error extracting jobs: Content script injection failed: site access denied');
});
