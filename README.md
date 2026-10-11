# Signal Desk

A local news review app for the 173 outlets in `sources.json` (transcribed from the supplied `agencies_updated.txt`). Choose a source, collect its headlines with Firecrawl, and refine the results with included and excluded phrases. The prepared news stream can be edited and exported as a Word update.

The homepage opens with a retrospective **Daily news update** for Monday to Friday, 5–9 October 2026. Its fixed coverage window runs from Monday at 00:00 to Friday at 23:59 in Vienna time. The 68 selected stories from 33 outlets have dates on their original article pages within that window. Read them in a single stream or download a Word report. The snapshot in `data/daily-update-2026-10-05-09.json` is a selected roundup, not an automatically refreshed or exhaustive feed. The previous 29-story version was a limited editorial selection from six outlets; it was not a full five-day crawl.

For a quick preview that does not clone or install the project, open the [static GitHub Pages preview](https://buddhuza.github.io/scrapeandreport/). It displays the prepared update, supports content management, and exports a customised Word update. Live Firecrawl collection requires the full server app below.

## Manage the website

Use **Manage site** in the top bar to edit the site title and intro, show or hide page areas, rename and reorder sections, edit or hide stories, add a story, add or hide news sources, and adjust light and dark palettes, font, and text size. The top bar also has a dark mode switch. Text starts at 18 px. Changes preview immediately and save to the current browser. The blue OSCE logo comes from the supplied Word template. **Download report** exports the displayed stories with the supplied Word template, including local edits. Its filename includes the coverage start and end in Vienna time, and the last page ends with the required disclaimer below a rule.

Section headings default to uppercase 26 px text, with larger site and report titles. Change heading size, capitalization, width, section names and subsection lists in **Manage site**. The light palette uses a beige background. International Organisations appears under Miscellaneous. Source-list categories only organize outlets for browsing; international agencies can supply articles in any report section. Ukraine lead stories use Reuters, AP, BBC and Politico reporting.

The manager's **Save & share** tab exports and imports a JSON settings file. Browser edits are private to that browser. To publish them for all visitors, replace `data/site-config.json` with the exported file, rebuild, and redeploy the site. The public site's default settings come from that file.

## Run locally

Requires Node.js 20 or newer and a Firecrawl API key.

```bash
npm ci
export FIRECRAWL_API_KEY=... # Set securely in your environment; never commit it.
npm run dev
```

Open the Vite development server URL shown in the terminal (normally port 5173). The API runs on port 3001. For a built frontend, run `npm run build` then `NODE_ENV=production npm start` and open port 3001.

Run `npm test` for the filtering, Firecrawl request, and Word report checks. The server requests one source when you press **Collect headlines**. It caches the Firecrawl response for five minutes. Candidates from every source are checked on their original article pages for publication date and time, then include and exclude phrases are applied. The app checks up to three matching original article pages per normal scan. **Deep scan source** checks up to ten. A zero-result scan does not establish that the source had no relevant news. Firecrawl usage and extraction quality depend on the sites and your plan. The app never fabricates missing dates.

Use **Collect visible sources** in **Manage site → Collect** after choosing a source-list region or search to gather several outlets at once. Clicking an outlet on the left also opens this tab. This makes at least one Firecrawl extraction request per source and up to three extra article requests when the listing lacks precise timestamps. Requests are paced to respect a ten-per-minute Firecrawl limit; collecting all 173 provided sources can take a long time and consume several Firecrawl credits per source. Failed sources are counted while successful results remain visible.

Internazionale appears under **Miscl**. Its collection uses the public Reuters feed at `https://www.internazionale.it/ultime-notizie-reuters`, accepts only article links from that feed, and labels them “Reuters”. The bottom **Websites without selected articles** panel lists every supplied outlet without a selected story and explains whether it was checked or not checked for this edition. It also records the NewsNow trial: Firecrawl read the World News index and followed a redirect to the original publisher, but the index lacked reliable publication times and the tested article was outside the coverage window. Live headline collection is in **Manage site → Collect**. The **Daily news update** stream can be edited in Manage site and exported to Word using the supplied template.

Word exports use a blanked copy of the supplied example in `server/templates/daily-update-template.docx`. Its logo, Calibri styles, blue section headings, A4 margins, and page-number footer are preserved. Lead-story topic bands and Miscellaneous country and organisation labels are pale blue; the seven Miscellaneous topic headings are unshaded. Only the prepared title, article paragraphs, and source appendix are populated for each export.

Keyword and site settings, including custom sources and dark mode, are stored in your browser's local storage. They are not shared between browsers. Export settings from Manage site to move them to another browser.
