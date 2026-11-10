## What changed
- Replaced daily scraping with the supplied Node.js collector and merged its source catalogue while retaining every existing source ID.
- Connected `collect:daily`, the editor-only Scrape control, and the daily/weekend draft workflows to completed native JSON. The web app and API read the edition and available full article bodies from that JSON; they do not call Firecrawl, Google Apps Script or Google Sheets.
- Preserved Supabase editor login, manual edits/imports, publication controls, Word/Excel exports, and the shared public edition. Collection creates a reviewable draft and does not publish it.
- Removed legacy feed and dated Google Sheet jobs. Collection is scheduled for 01:00 and 13:00 Europe/Vienna after merge; shared publication remains manual.

## Verification
- Tested BBC as one publisher, then ran the complete catalogue on a GitHub runner without Firecrawl or Google Sheet credentials. The BBC run checked 3 routes with no failures and selected 7 stories, including 4 full bodies. The full run checked 749 routes (115 failed), selected 35 stories and stored 8 full bodies. The full source audit, selected stories and extracted bodies are in `data/prepared-update.json` and the native integration run artifact.
- `npm test`: 249 passing. `npm run build`: passed. `node scripts/verify-native-edition.mjs data/prepared-update.json`: checked the DNU rendering data and generated Word/Excel exports. The local API served the new edition and correctly rejected an unauthenticated Collect request.
- The draft's source audit records failed routes and stories without full text; review these before publishing. Article bodies are exported only where full-text extraction succeeded.

## Deployment and activation after review
1. Deploy a persistent Node 24.5+ server with a writable `data/` directory and `SUPABASE_URL` plus `SUPABASE_ANON_KEY`; route website `/api/*` to it. GitHub Pages alone cannot run the Scrape control or display live collection progress.
2. Run a manual native collection job or `npm run collect:daily` and review `data/prepared-update.json`, including source failures, story placement and body coverage.
3. When the edition is approved, run the separate manual publish job or `npm run publish:shared` using server-side `SUPABASE_SERVICE_ROLE_KEY`. Build and deploy the website assets separately.
4. The twice-daily GitHub Actions job starts after merge and retains draft JSON artifacts. To display progress and run Scrape directly from the website, deploy the persistent Node server; `npm run schedule` can run there instead of the GitHub timer. Neither route publishes to Supabase or sends email automatically.
