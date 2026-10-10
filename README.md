# Signal Desk

A local news review app for Google News and the 172 outlets in `sources.json` (transcribed from the supplied `agencies_updated.txt`). Choose a source, collect its headlines with Firecrawl, refine the results with included and excluded phrases, select stories, review their full articles, and download a Word or Markdown report.

The homepage opens with the prepared **Daily news update** in the supplied section and story format. It displays only items from the prepared snapshot whose publication timestamps are still within the rolling 24-hour window. Use **Add to report** on any story, or download the prepared Word update directly. The snapshot in `data/daily-update-2026-10-09.json` is a selected roundup, not an automatically refreshed or exhaustive feed; the collection controls below it are for gathering new articles.

For a quick preview that does not clone or install the project, open the [static GitHub Pages preview](https://buddhuza.github.io/scrapeandreport/). It displays the prepared update, supports content management, and exports a customised Word update. Live Firecrawl collection requires the full server app below.

## Manage the website

Use **Manage site** in the top bar to edit the site title and intro, show or hide the hero and coverage note, rename and reorder sections, edit or hide stories, add a story, and choose a theme or individual colors and font. Changes preview immediately and save to the current browser. **Download customised Word** exports the displayed stories with the supplied Word template, including local edits.

The manager's **Save & share** tab exports and imports a JSON settings file. Browser edits are private to that browser. To publish them for all visitors, replace `data/site-config.json` with the exported file, rebuild, and redeploy the site. The public site's default settings come from that file.

## Run locally

Requires Node.js 20 or newer and a Firecrawl API key.

```bash
npm ci
export FIRECRAWL_API_KEY=... # Set securely in your environment; never commit it.
npm run dev
```

Open the Vite development server URL shown in the terminal (normally port 5173). The API runs on port 3001. For a built frontend, run `npm run build` then `NODE_ENV=production npm start` and open port 3001.

Run `npm test` for the filtering, Firecrawl request, and Word report checks. The server requests one source when you press **Collect headlines**. It caches the Firecrawl response for five minutes. Google News search is scoped to one day and the selected include phrases. Results from all sources are checked again against publication time, then include and exclude phrases. For source listings with missing or date-only timestamps, the app checks up to three matching original article pages for precise publication times. **Deep scan source** checks up to ten. A zero-result scan does not establish that the source had no relevant news. Firecrawl usage and extraction quality depend on the sites and your plan. The app never fabricates missing dates.

Use **Collect visible sources** after choosing a region or searching the source list to gather several outlets at once. This makes at least one Firecrawl extraction request per source and up to three extra article requests when the listing lacks precise timestamps. Requests are paced to respect a ten-per-minute Firecrawl limit; collecting all 173 entries can take a long time and consume several Firecrawl credits per source. Failed sources are counted while successful results remain visible.

Select a headline, then press **Review full article**. The app checks the article's publication time and proposes a factual one-sentence summary based on its first paragraphs. Edit the summary, section, and country or topic before export. Export requires every selected article to be reviewed. The Word and Markdown reports group stories by section and hyperlink the agency name to the article. They list collection failures separately from fetched pages without a selected article; the latter is not evidence that the source lacked relevant news.

Word exports use a blanked copy of the supplied example in `server/templates/daily-update-template.docx`. Its logo, Calibri styles, blue section headings, shaded subsection bands, A4 margins, and page-number footer are preserved. Only the prepared title, article paragraphs, and source appendix are populated for each export.

The selected report, title, and keyword settings are stored in your browser's local storage. They are not shared between browsers.
