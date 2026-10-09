# Signal Desk

A local news review app for Google News and the 172 outlets in `sources.json` (transcribed from the supplied `agencies_updated.txt`). Choose a source, collect its headlines with Firecrawl, refine the results with included and excluded phrases, select stories, and download a Markdown report.

## Run locally

Requires Node.js 20 or newer and a Firecrawl API key.

```bash
npm ci
export FIRECRAWL_API_KEY=... # Set securely in your environment; never commit it.
npm run dev
```

Open the Vite development server URL shown in the terminal (normally port 5173). The API runs on port 3001. For a built frontend, run `npm run build` then `NODE_ENV=production npm start` and open port 3001.

Run `npm test` for the filtering and Firecrawl request checks. The server requests one source when you press **Collect headlines**. It caches the Firecrawl response for five minutes. Google News search is scoped to one day and the selected include phrases. Results from all sources are checked again against publication time, then include and exclude phrases. Headlines without a parseable publication timestamp are omitted, so some sources may return no verified results. Firecrawl usage and extraction quality depend on the sites and your plan. The app never fabricates missing dates.

Use **Collect visible sources** after choosing a region or searching the source list to gather several outlets at once. This makes one Firecrawl request per source, with at most four running concurrently. Collecting all 173 entries can take time and consume Firecrawl credits. Failed sources are counted while successful results remain visible.

The selected report, title, and keyword settings are stored in your browser's local storage. They are not shared between browsers. The report exports as Markdown with source names, publication times, and links.
