# LinkedIn Job Copier - Browser Extension (Chrome, Edge, Brave or any chromium based browser)

A browser extension that adds a **"Copy Job Description"** button to LinkedIn job listings, and lets you scrape & export all job cards from a search results page.

> This is a fork of [PavanBJ/linkedin-job-copier](https://github.com/PavanBJ/linkedin-job-copier), with a reworked bulk-extraction flow and a test suite added.

---

## ✨ Features

- **📋 Copy Job Description** — One-click copy of the full job description (title, company, location, URL + description) to clipboard, formatted cleanly for sharing with people or LLMs
- **Copy Summary** — Copies just the title, company, location & URL (no description)
- **Extract Jobs by Page** — Enter a page range (e.g. pages 1 to 5) and the extension clicks through each page of LinkedIn search results, extracting the jobs page by page
- **Copy All as Text** — Copies the entire scraped list as formatted text
- **⬇ Export CSV** — Downloads all scraped jobs as a `.csv` file

---

## 🚀 Installation

### Chrome / Brave / Edge / Arc / Vivaldi (any Chromium browser)

1. **Download & unzip** this folder somewhere on your computer
2. Open your browser and go to the extensions page:
   - **Chrome**: `chrome://extensions`
   - **Brave**: `brave://extensions`
   - **Edge**: `edge://extensions`
   - **Arc**: Type `extensions` in the command bar
3. Enable **Developer Mode** (toggle in the top-right corner)
4. Click **"Load unpacked"**
5. Select the `linkedin-job-copier` folder
6. The extension icon (🔷) will appear in your toolbar

> **Note for Edge**: You may see a prompt asking if you want to keep the extension — click "Keep it".

---

## 📖 How to Use

### Copy a Single Job Description
1. Go to any LinkedIn job listing (e.g., `linkedin.com/jobs/view/...`)
2. Click on a job in the list — the right panel will show the job details
3. A **"📋 Copy Job Description"** button will appear below the Apply button
4. Click it → the full job description is now in your clipboard!

### Extract Jobs Across Several Pages
1. Go to LinkedIn Jobs search results (`linkedin.com/jobs/search-results/...`). If you're anywhere else, click the extension icon and pick **"Jobs based on your preferences →"** or **"Jobs that match your profile →"**: it opens `linkedin.com/jobs/` and clicks that section's **Show all** for you, which lands on search results.
2. Click the extension icon. The page fields start at the page you're on. The extraction controls only appear on `linkedin.com/jobs/search-results` pages.
3. Enter the pages to go through (e.g. **Pages 1 to 5**), then click **"Extract Jobs"**
4. Click **"Copy All as Text"** or **"⬇ Export CSV"**

---

## 🌐 Cross-Browser Compatibility

This extension uses the standard **WebExtensions API (Manifest V3)** which is supported by all Chromium-based browsers:

| Browser | Compatible? |
|---------|------------|
| Chrome  | ✅ Yes |
| Brave   | ✅ Yes |
| Edge    | ✅ Yes |
| Arc     | ✅ Yes |
| Vivaldi | ✅ Yes |
| Opera   | ✅ Yes |
| Firefox | ⚠️ Mostly (requires minor tweaks for MV3 differences) |
| Safari  | ❌ No (uses different extension system) |

---

## ⚠️ Notes

- Page-range extraction moves between pages by clicking LinkedIn's own pagination buttons (the **Page N** button, or **Next**/**Previous**), waits for the result list to change, and collects the job IDs of the cards on each page. It then reads each new job's title, company, location and full description from LinkedIn's public job-posting page (`/jobs-guest/jobs/api/jobPosting/{JOB_ID}`), 3 at a time, before moving to the next page. Jobs repeated across pages are kept once. If a requested page doesn't exist, it stops there and keeps what it has. It does not scroll the list, so only cards LinkedIn has rendered are collected. Progress continues if you close the popup; reopen it to see the result, or press **Stop**. Jobs that can't be read (for example when LinkedIn rate-limits) keep whatever the card showed.
- The CSV columns are `jobId,title,company,location,jobUrl,aboutTheJob`.
- LinkedIn periodically updates its page structure. If extraction breaks, the structural selectors in `content.js` may need updating.
- The extension only activates on `linkedin.com/jobs/*` pages.
- No data is sent anywhere — everything runs locally in your browser.

---

## 📁 File Structure

```
linkedin-job-copier/
├── manifest.json      # Extension config (Manifest V3)
├── content.js         # Injected into LinkedIn pages, adds Copy button
├── content.css        # Styles for the injected button & toast
├── popup.html         # Extension popup UI
├── popup.css          # Popup styles
├── popup.js           # Popup logic
├── test/              # Test suite
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```
