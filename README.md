# DNU

## Project instructions

The versioned [DNU rulebook](public/dnu-rules.md) is the single editable Markdown file for standing editorial, site design, export and collection workflow rules. It is publicly readable at `https://buddhuza.github.io/dnu/dnu-rules.md`, without a link in the public site header. To edit it, open the file on GitHub, click the pencil, and commit to `main`. The rules file is then republished to GitHub Pages. A written rule does not by itself enforce behavior: update and deploy the relevant code or collection workflow too. The older `editorial-policy.md` and `site-specification.md` URLs point to the rulebook.

## Shared public site and editor login

The shared edition uses Supabase Auth and Postgres while GitHub Pages serves the website. Visitors can browse, switch views, search, download, email and export. Only the signed-in editor can add, import, edit or manage the site. The editor's changes are saved to the shared edition; public browsers load it immediately on opening and poll for changes every 20 seconds. Dark mode remains a personal browser setting. Native collection requires the Node server or an offline GitHub Actions run. Collection creates a draft JSON and does not automatically publish to Supabase.

To activate shared editing for a new Supabase project:

1. Create a Supabase project. In **SQL Editor**, run [supabase/schema.sql](supabase/schema.sql). The SQL creates a public-read edition and body store, and a publishing function restricted to the DNU editor email.
2. In **Authentication → Users**, create the editor account for the authorised email. Set a fresh password there. Do not put any password in `.env`, GitHub, SQL or chat transcripts used as setup files.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the project's API settings for the website build. Copy [.env.example](.env.example) to an ignored `.env.production.local` for a local build. The anon/publishable key is allowed in browser code; never use a service-role key in a `VITE_` variable.
4. Build and publish GitHub Pages with those two variables. Open the public website in one browser and log in from another. Import a sheet or edit a story, wait for **Saved for everyone**, then confirm the public browser updates. A first login before any import shows the bundled prepared edition.

If an import says **Not published: DELETE requires a WHERE clause**, rerun the latest [supabase/schema.sql](supabase/schema.sql) in the project's SQL Editor. The updated publishing functions use a WHERE clause when replacing the article-body cache. Then reload the website and import the sheet again.

After reviewing a native draft, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only in the publication process, then run `npm run publish:shared`. This copies the prepared edition and available JSON full bodies to the shared database. The service-role key must never be used in a website build.

The GitHub Pages deployment is configured for shared editing. Publishing-function changes in `supabase/schema.sql` must also be run in the Supabase SQL Editor; updating the repository alone does not change the live database.

## Native collector cutover (pending review)

The attached Node collector is installed in `collector/`. The combined `sources.json` retains all 173 prior IDs and adds the supplied outlets: 297 catalogue entries spanning 296 domains. `npm run collect:daily` uses Node 24.5+ to read publisher feeds and pages and Google News RSS discovery. It writes `data/prepared-update.json` atomically and preserves the previous edition when selection is empty. The file contains the selected stories, route audit, rejected rows and full article text where extraction succeeded. No Firecrawl, Google Apps Script or Google Sheet credential is needed for collection.

Run `DNU_TEST_DOMAIN=bbc.com npm run collect:daily` to test one publisher; its result is `data/native-test-edition.json`. Then run `npm run collect:daily` without the variable. `npm run schedule` is available only for a persistent Node server; it prepares a draft after 01:00 and releases the completed local JSON after 05:00 Europe/Vienna. **It is not enabled by this PR.** The daily and weekend GitHub Actions jobs are manual draft checks only. The former feed jobs and Google Sheet weekend job are retired in this branch.

The Node server reads completed JSON on every `/api/daily-update` and `/api/daily-update.docx` request. Its Collect endpoint requires a valid Supabase editor session; set `SUPABASE_URL` and `SUPABASE_ANON_KEY` on that server. The GitHub Pages site has no Node API, so its Collect control reports unavailable until a persistent Node server is deployed behind the site. The editor can preview a collected draft without publishing it. The public site continues to read the existing shared Supabase edition until the separate publication command is run.

To deploy after review: deploy a persistent Node 24.5+ server with a writable `data/` directory and the public Supabase URL and anon key, route `/api/*` from the website to that server, and test editor-only Collect. Run the manual **Test daily native collection** workflow or `npm run collect:daily` on the server. Review `data/prepared-update.json`, body coverage and source failures; then use the manual **Publish reviewed native DNU edition** workflow or `npm run publish:shared` with server-only service-role credentials. Build and deploy GitHub Pages separately to update bundled assets. Add a daily/weekend schedule only after confirming the runner persists the JSON and the release path is safe. No production schedule, shared publication or Outlook send is activated here.

Rollback by reverting the integration PR, restoring the previous prepared JSON and re-enabling the prior collection configuration only if still needed.

### Send through classic Outlook on a Windows computer

This is an optional, separate email tool for a reviewed edition. The native collector PR does not schedule or send Outlook email.

1. In GitHub **Settings → Secrets and variables → Actions → Variables**, add `DNU_MAIL_DELIVERY` with value `windows`. Keep `SUPABASE_SERVICE_ROLE_KEY` as a repository secret so the weekend workflow can publish. The Graph secrets are unnecessary in this mode. This setting stops the GitHub workflow from sending a second email.
2. On the Windows computer, install Node.js 22 or later and **classic Outlook for Windows**. Sign in to the intended work account in Outlook. New Outlook does not support this COM script. Keep the computer awake and the Windows account signed in for scheduled sending.
3. Download or clone this repository to the computer. Open a command prompt in its `dnu` folder and run `npm ci` once.
4. Copy `scripts\windows-outlook.config.example.json` to `scripts\windows-outlook.config.json`. Fill in the **public** Supabase publishable/anon key, the exact Outlook `senderAccount` email address, and the `mailingLists` addresses. The filled config is ignored by Git. Do not put a service-role key in it.
5. When the public site has a prepared weekend edition for today, preview it with `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Send-DnuWithOutlook.ps1`. This opens an unsent draft with the formatted update and logo. Check the recipients and formatting.
6. In Windows **Task Scheduler**, create one weekly task for **Saturday and Sunday at 07:55**. Use **Run only when user is logged on**, **Wake the computer to run this task**, and the same signed-in Windows account that has the Outlook profile. Set **Program** to `powershell.exe` and **Arguments** to `-NoProfile -ExecutionPolicy Bypass -File "C:\path\to\dnu\scripts\Send-DnuWithOutlook.ps1" -Send -AtEight`. Use the actual DNU path. Set the Windows clock to the Vienna time zone, or adjust the task trigger so it starts at 07:55 Vienna time. The script waits until 08:00 Vienna time after preparing the message, and refuses a late send.

The Windows script keeps a local `scripts\windows-outlook-send-state.json` claim so a rerun on that computer cannot send the same date twice. If Outlook fails after the claim, inspect Sent Items before resetting that file. Use only one sending computer. Outlook's programmatic-access policy may require an administrator to permit unattended sending. Exact inbox delivery time still depends on Outlook and the mail server.

Before the first shared import, the homepage opens with the bundled edition in `data/prepared-update.json`. The previous English-language edition remains in `data/daily-update-2026-10-24.json`, and its scraped article pages remain in the cache. Dated editions remain in `data/`.

NEWSRUN now invokes the native collector to create a draft JSON. Publication is separate and requires review.

FEEDRUN now uses the same native collector; the separate direct-feed scraper is retired.

For a quick preview that does not clone or install the project, open the [static GitHub Pages preview](https://buddhuza.github.io/dnu/). Once shared login is activated, visitors see the current edition and exports, while the editor can log in to change it. The Collect button requires a Node server; manual Add remains available to the logged-in editor.

## Test native collection without publishing

Use **Actions → Native collector integration check (draft only)** on the integration branch for a BBC-only run followed by a full run. The status and JSON are saved on a `native-check-...` branch. On `main`, **Test daily native collection** can be run manually and uploads the completed JSON as an artifact. Neither workflow publishes the public site or sends email. The source route audit in the JSON distinguishes checked and failed routes; article bodies are present only for successful full-text extractions.

## Manage the website

In local development, use **Manage site** in the top bar to edit the site title, show or hide page areas, rename and reorder sections, edit or hide stories and their summaries, add a story, add or hide news sources, and adjust light and dark palettes, font, and text size. The top bar also has a dark mode switch. Text starts at 18 px. Changes preview immediately and save to the current browser. The website header has no logo; the supplied Word template retains its OSCE logo. **Download** exports only the checked stories, each with the publisher's headline capitalisation preserved unless it is all caps, one factual summary sentence adding information beyond the headline, and the linked agency name, using the supplied Word template and including local edits. Its filename includes the coverage start and end in Vienna time, and the last page ends with the required disclaimer below a rule. The website shows the same disclaimer above its coverage note. Selecting a source on the left opens its website beside the update; publishers that block embedding can be opened with the direct link above the frame.

Press **Edit** beside **Download** in the update header to show a checkbox for every story. Press **Save** to return to the update with only checked stories visible. Reopen **Edit** to change the selection; it is saved in this browser, and Word downloads use the checked stories. In Edit mode, drag a story (or use its handle on a touch screen) to place it before or after another story, or drop it on a section, subsection, country heading, or empty target. Placement and order are saved in this browser and used by the Word download. The magnifying glass beside **Add** searches the visible update; use the arrow buttons or Enter to move between matching stories.

The **Import spreadsheet** button beside **Add** reads a DNU database export or a similar `.xlsx` or `.csv` file in your browser. It previews usable and skipped rows, then adds the stories to the current DNU. An imported URL already in the update refreshes that story; other stories and their edits remain. Available full article bodies are added to the browser and shared caches for later spreadsheet export. Use **Clear all stories** in Import when you want an empty update. Import uses no Firecrawl credits. In the logged-in shared editor, changes publish through Supabase for all visitors.

The spreadsheet icon between **Email** and **Search** exports the currently visible stories to an `.xlsx` workbook for database import. Columns are Date, Source, Region, Countries, Local Regions, Organizations, Themes, Types, Source URL, Heading, and Body. Region and the first Countries or Organizations entry follow each story's current heading in the update, including moves and Lead stories; other countries and organisations mentioned in the article follow. Optional fields without reliable data are blank. For native stories, full article bodies come directly from the completed JSON. The GitHub Pages build can include an `article-bodies.json` snapshot, and the browser also saves available bodies in IndexedDB. Missing bodies are reported and are not fetched through Firecrawl. If an article is unavailable, export continues with the others and shows the final counts and failed titles. Non-English articles that yield a verified English headline and summary are marked `(文A)` in the update; their spreadsheet body uses a full English translation when one is available.

To publish the prepared edition with its body cache, run `npm run build:pages:with-cache`, then `node scripts/sync-pages.mjs dist /path/to/gh-pages-worktree` and commit and push that worktree. The sync overwrites current files while retaining older hashed files in `assets/` so an already open browser tab can still load its Add dialog after a deployment. Do not delete the old hashed assets during deployment. The generated `dist/article-bodies.json` is publicly accessible. It contains extracted article text, not Firecrawl credentials or the raw scrape cache. Rebuild it after changing `data/prepared-update.json` or any article-cache shard.

Press **Add** to enter an article URL, headline, agency and text manually. Manual edits and imports retain their existing Supabase publishing workflow; the native collector does not replace them.

Section headings default to uppercase 26 px text, with larger site and report titles. The report coverage date appears beneath **DAILY NEWS UPDATE** at headline text size. Change heading size, capitalization, width, section names and subsection lists in **Manage site**. The light palette uses a beige background. International Organisations appears under Miscellaneous. Source-list categories only organize outlets for browsing; international agencies can supply articles in any report section. The current lead section has four major Ukraine headlines and one Middle East headline; its topic is labeled **MIDDLE EAST**. Other headlines remain in their regional sections.

The manager's **Save & share** tab exports and imports a JSON settings file. Browser edits are private to that browser. To publish them for all visitors, replace `data/site-config.json` with the exported file, rebuild, and redeploy the site. The public site's default settings come from that file.

## Run locally

Use Node.js 24.5 or newer. Install the locked dependencies with npm ci, then start the Node API and Vite app with npm run dev. Open the Vite URL shown in the terminal. The API uses port 3001. For a built frontend, run npm run build and then NODE_ENV=production npm start.

Run DNU_TEST_DOMAIN=bbc.com npm run collect:daily first. It writes data/native-test-edition.json. Run npm run collect:daily without that variable for a full draft. The collector writes data/prepared-update.json through an atomic rename, leaving the earlier file intact if no article qualifies. Restarting the server is unnecessary: the API reads the completed file for each request. It serves stored full article text only where extraction succeeded.

For a local editor Collect button, configure the normal public Supabase URL and anon key in the browser build and set SUPABASE_URL and SUPABASE_ANON_KEY on the Node server. The server verifies the editor's access token; anonymous users cannot start collection. A local draft preview does not publish it to Supabase. Keep the service-role key only in the separate publication process.

Run npm test and npm run build before deployment. The manual GitHub Actions collection jobs save JSON drafts only. Production scheduling, shared publication and Outlook email remain disabled until reviewed.
