# Signal Desk

A local news review app for Google News and the 172 outlets in `sources.json` (transcribed from the supplied `agencies_updated.txt`). Choose a source, collect its headlines with Firecrawl, refine the results with included and excluded phrases, select stories, review their full articles, and download a Word or Markdown report.

## Run locally

Requires Node.js 20 or newer and a Firecrawl API key.

```bash
npm ci
export FIRECRAWL_API_KEY=... # Set securely in your environment; never commit it.
npm run dev
```

Open the Vite development server URL shown in the terminal (normally port 5173). The API runs on port 3001. For a built frontend, run `npm run build` then `NODE_ENV=production npm start` and open port 3001.

Run `npm test` for the filtering, Firecrawl request, and Word report checks. The server requests one source when you press **Collect headlines**. It caches the Firecrawl response for five minutes. Google News search is scoped to one day and the selected include phrases. Results from all sources are checked again against publication time, then include and exclude phrases. Headlines without a parseable publication timestamp are omitted, so some sources may return no verified results. Firecrawl usage and extraction quality depend on the sites and your plan. The app never fabricates missing dates.

Use **Collect visible sources** after choosing a region or searching the source list to gather several outlets at once. This makes one Firecrawl extraction request per source. Requests are paced to respect a ten-per-minute Firecrawl limit; collecting all 173 entries can take a long time and consume several Firecrawl credits per source. Failed sources are counted while successful results remain visible.

Select a headline, then press **Review full article**. The app checks the article's publication time and proposes a factual one-sentence summary based on its first paragraphs. Edit the summary, section, and country or topic before export. Export requires every selected article to be reviewed. The Word and Markdown reports group stories by section, hyperlink the agency name to the article, and list attempted sources that produced no selected article. Source outcomes distinguish failed retrieval from an accessible page with no article included in the selected roundup.

The selected report, title, and keyword settings are stored in your browser's local storage. They are not shared between browsers.
