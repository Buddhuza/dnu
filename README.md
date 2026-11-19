# DNU

## Project instructions

The versioned [DNU rulebook](public/dnu-rules.md) is the single editable Markdown file for standing editorial, site design, export and collection workflow rules. It is publicly readable at `https://buddhuza.github.io/dnu/dnu-rules.md`, without a link in the public site header. To edit it, open the file on GitHub, click the pencil, and commit to `main`. The rules file is then republished to GitHub Pages. A written rule does not by itself enforce behavior: update and deploy the relevant code or collection workflow too. The older `editorial-policy.md` and `site-specification.md` URLs point to the rulebook.

## Shared public site and editor login

The shared edition uses Supabase Auth and Postgres while GitHub Pages serves the website. Visitors can browse, switch views, search, download, email and export. Signed-in members of `dnu_editors` can add, import and edit. Only the owner can open **Manage site**. Their changes are saved to the same shared edition; public browsers load it immediately on opening and poll for changes every 20 seconds. Dark mode remains a personal browser setting. Native collection requires the Node server or an offline GitHub Actions run. Collection creates a draft JSON and does not automatically publish to Supabase.

To activate shared editing for a new Supabase project:

1. Create a Supabase project. In **SQL Editor**, run [supabase/schema.sql](supabase/schema.sql). The SQL creates a public-read edition and body store, an editor membership table, and a publishing function restricted to active members.
2. In **Authentication → Users**, create the editor account for the authorised email. Set a fresh password there. Do not put any password in `.env`, GitHub, SQL or chat transcripts used as setup files.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the project's API settings for the website build. Copy [.env.example](.env.example) to an ignored `.env.production.local` for a local build. The anon/publishable key is allowed in browser code; never use a service-role key in a `VITE_` variable.
4. Build and publish GitHub Pages with those two variables. Open the public website in one browser and log in from another. Import a sheet or edit a story, wait for **Saved for everyone**, then confirm the public browser updates. A first login before any import shows the bundled prepared edition.

If an import says **Not published: DELETE requires a WHERE clause**, rerun the latest [supabase/schema.sql](supabase/schema.sql) in the project's SQL Editor. The updated publishing functions use a WHERE clause when replacing the article-body cache. Then reload the website and import the sheet again.

After reviewing a native draft, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only in the publication process, then run `npm run publish:shared`. This copies the prepared edition and available JSON full bodies to the shared database. The service-role key must never be used in a website build.

The GitHub Pages deployment is configured for shared editing. Publishing-function changes in `supabase/schema.sql` must also be run in the Supabase SQL Editor; updating the repository alone does not change the live database.

### Add individual editors to the existing project

1. In the project's **SQL Editor**, run [supabase/multi-editor.sql](supabase/multi-editor.sql). It is safe to rerun if the previous multi-editor migration was applied. It registers the existing owner account as username `lkhubulava` and restricts site settings to the owner.
2. In a trusted local shell, set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `DNU_TEMP_PASSWORD` to the newly requested temporary password, then run `npm run editors:create`. **Never put the service-role key or password in the website build or source code.** The script creates `gjordan`, `vnikolov`, `vjosifovic` and `mristevski` if absent, or updates those four accounts' temporary passwords if present. It registers their editor access and never changes `lkhubulava`'s password. There are no real email addresses for these users yet, so the script gives them private-use `.invalid` Auth addresses; password recovery by email will not work until each account gets a real address. The owner account keeps its existing Supabase email behind the username `lkhubulava`.
3. Each user can change the temporary password under **Account** after signing in.
4. Redeploy the `start-dnu-collection` Edge Function using the existing [deployment workflow](https://github.com/Buddhuza/dnu/actions/workflows/deploy-collection-trigger.yml) on `main` so new members can use **Scrape**. If the optional Node server is deployed, redeploy it too. Both check the same membership table.

Editors log in with their short usernames and individual passwords. The four colleagues can use DNU editing tools and their own **Account** screen to change passwords; they cannot open **Manage site**. In edit mode, the story text has a subtle colour keyed to the person who last edited it, or the person who added it if it has not been edited. `lkhubulava` is purple; other editors get stable distinct colours. Add, Import and Scrape use different strengths of that colour, and small labels name the contributors. Older stories with no saved attribution stay neutral. Attribution is stored with the published update, but the labels are visible only in edit mode. If two people save from stale copies, the later save is rejected by the edition revision check; reload the shared edition before retrying.

### Send the published update through Gmail

The owner-only paper-plane button beside **Email** sends the published, visible DNU with the sender shown as **OSCE SitRoom** (`sitroom.github@gmail.com`) to the saved recipients. The list initially contains `buddhuza@gmail.com` and `ayabushady@gmail.com`. The owner can edit it under **Manage site → Email**; enter one address per line and press **Save recipients**. Wait for **Saved for everyone** before sending. The send workflow reads the current list and published edition together, and refuses to send if the edition changes after the click. The message uses the current full or compressed view, the same rich HTML layout as the existing Email/Word report, and the inline OSCE logo. The sender and message body are fixed. The existing envelope button still copies the report and opens a draft in the default email application.

The Gmail workflow is scheduled every day for **16:00 Europe/Vienna**. It reads the latest published update and recipient list, sends the full view, and prefixes the subject with **[TEST]**. Manual paper-plane sends use that subject prefix too. UTC schedules at 14:00 and 15:00 cover summer and winter; a Vienna time check skips the other candidate. Backup slots at 16:10 and 16:20 check whether the Gmail send step has already succeeded that day and send only if it has not. GitHub did not start the first 21:30 scheduled run on 18 November 2026, and GitHub Actions can delay or omit scheduled jobs, so the GitHub schedule cannot guarantee an exact send. The site does not need to be open, but the GitHub Actions secrets below must remain configured. A manual rerun of a successful job may send the email again.

Supabase Cron also invokes `schedule-dnu-email` at the same Vienna slots. The Edge Function checks a random token stored in both Supabase Vault and Edge secrets, reads the published revision and dispatches the Gmail workflow. The workflow checks for an earlier successful scheduled Gmail send step before sending; the GitHub cron remains a backup. The six UTC jobs are defined in [supabase/scheduled-gmail.sql](supabase/scheduled-gmail.sql). This is more resilient than GitHub cron alone, though an exact delivery time still depends on GitHub Actions and Gmail availability.

To activate the paper-plane button:

1. Sign in to the Google account `sitroom.github@gmail.com`. Open **Google Account → Security → 2-Step Verification → App passwords**. Turn on 2-Step Verification first if necessary, create an app password named **DNU website**, and copy the generated app password. This is *not* the account's normal Gmail password. If **App passwords** is unavailable, this SMTP route cannot be enabled under the account's current Google security settings.
2. In `Buddhuza/dnu` on GitHub, open **Settings → Secrets and variables → Actions → New repository secret**. Create `GMAIL_APP_PASSWORD` and paste that app password. Never put it in `public/`, `.env.production.local`, a browser setting, or this repository's files.
3. In the same GitHub Actions secrets page, create `DNU_SUPABASE_PUBLISHABLE_KEY` with the project's *public* publishable key from **Supabase → Project Settings → API Keys**. It starts with `sb_publishable_`. Do not use the Supabase service-role key here. The send job uses this key to read the published edition.
4. The existing `DNU_WORKFLOW_TOKEN` and `SUPABASE_ACCESS_TOKEN` repository secrets must also be configured for the owner-only Supabase Edge Function. The [deploy workflow](https://github.com/Buddhuza/dnu/actions/workflows/deploy-collection-trigger.yml) deploys `send-dnu-email` after the code reaches `main`; run it manually if it did not complete. Gmail credentials stay in GitHub Actions, never on the public site or in Supabase.
5. Log in as `lkhubulava`, wait for **Saved for everyone**, choose the full or compressed view, and press the paper-plane button. The site shows queued, sent or failed status. The send workflow reads the live shared edition again and refuses to send if it changed after the click. GitHub Actions may take a short time to start the job.

## Native collector

The attached Node collector is installed in `collector/`. The combined `sources.json` retains all 173 prior IDs and adds the supplied outlets: 297 catalogue entries spanning 296 domains. `npm run collect:daily` uses Node 24.5+ to read publisher feeds and pages and Google News RSS discovery. It writes `data/prepared-update.json` atomically and preserves the previous edition when selection is empty. The file contains the selected stories, route audit, rejected rows and full article text where extraction succeeded. No Firecrawl, Google Apps Script or Google Sheet credential is needed for collection.

Run `DNU_TEST_DOMAIN=bbc.com npm run collect:daily` to test one publisher; its result is `data/native-test-edition.json`. Then run `npm run collect:daily` without the variable. The [GitHub collection workflow](https://github.com/Buddhuza/dnu/actions/workflows/test-daily-collection.yml) runs at 01:00 and 13:00 Europe/Vienna and supports **Run workflow** on `main`. It uploads the JSON as an artifact and places the completed draft at `native-draft.json` on GitHub Pages for the logged-in editor to review. This does not replace the shared Supabase edition. Scheduled jobs may start later than their nominal time on GitHub. The weekend workflow remains a manual draft check.

The GitHub Pages dashboard uses the GitHub Actions collector by default. The editor's **Scrape** control opens a status dialog without starting collection. **Publish** loads the latest completed JSON and adds its new article URLs and available full bodies to the shared Supabase site in one action, retaining older stories and editor changes. The dialog shows when that scrape finished in Vienna time. Its separate **Scrape** button starts a new collection through an editor-only Supabase Edge Function; progress text appears at the bottom of the dialog with animated dots. Only **Clear all stories** empties the shared update. The public site continues to read the existing shared edition until the editor publishes. The optional Node server reads completed JSON on every `/api/daily-update` and `/api/daily-update.docx` request; its Collect endpoint requires a valid Supabase editor session.

### Enable one-click Scrape once

The browser cannot hold a GitHub token safely. `supabase/functions/start-dnu-collection/index.ts` verifies the editor's Supabase login and uses a server-side token to start the existing GitHub workflow. To enable it:

1. In GitHub, create a **fine-grained personal access token** for `Buddhuza/dnu` with **Actions: Read and write**. Set an expiration you can renew. Do not place the token in the website or this repository.
2. In Supabase Account Settings, create a **personal access token** that can deploy functions to project `epghsyajgspcywqqbfso`.
3. In the GitHub repository's **Settings → Secrets and variables → Actions**, add `DNU_WORKFLOW_TOKEN` (step 1) and `SUPABASE_ACCESS_TOKEN` (step 2) as repository secrets. GitHub reserves names beginning with `GITHUB_`; the deployment workflow stores `DNU_WORKFLOW_TOKEN` in Supabase as `GITHUB_WORKFLOW_TOKEN` automatically. Do not paste either token into chat.
4. Run [Deploy one-click DNU scrape trigger](https://github.com/Buddhuza/dnu/actions/workflows/deploy-collection-trigger.yml) once on `main`. It stores the GitHub token in Supabase function secrets and deploys the function. The token is never included in the Pages build.
5. Sign in to the dashboard, open the scrape dialog, and press **Publish** to publish the latest completed edition for everyone. Press the dialog's **Scrape** button first if you need a newer edition.

If the GitHub token expires, replace the repository secret and rerun the deployment workflow. The 01:00 and 13:00 Vienna schedule does not depend on this token.

### Optional: deploy the editor Scrape API on Render

The [Render Blueprint](render.yaml) defines a Node 24.5+ web service with a 1 GB persistent disk at `/var/data`. The Starter service and disk may incur charges; review Render's price before creating it. It uses only the public Supabase project URL and publishable key. Do not add a Supabase service-role key to this API service. The server verifies the signed-in editor's Supabase access token before starting a scrape.

1. Open [Deploy this Blueprint on Render](https://render.com/deploy?repo=https://github.com/Buddhuza/dnu), sign in, connect the `Buddhuza/dnu` GitHub repository, and select `render.yaml` on `main`. Approve the service and disk in your Render account. Render will build with `npm ci` and start with `npm start`.
2. Open the Render service URL followed by `/api/health`. It should return `{"ok":true,...}`. The expected URL is `https://buddhuza-dnu-api.onrender.com`, but use the actual URL shown by Render. The disk is seeded with the bundled completed edition the first time the service starts. Later collection drafts and progress remain on the disk through service restarts.
3. To switch from GitHub Actions to Render, change `window.DNU_COLLECTION_MODE` to `node` and set `window.DNU_API_URL` in [public/api-config.js](public/api-config.js) to Render's actual HTTPS URL without `/api`, then rebuild and deploy GitHub Pages. The browser calls Render directly for Scrape and progress.
4. Sign in as the editor, press **Scrape**, and watch the route, article and full-text progress. The result is a draft for review. The 01:00 and 13:00 GitHub Actions jobs remain separate draft artifacts; they do not update this Render disk or publish to Supabase.

Review the GitHub draft, body coverage and source failures before publication. The **Publish reviewed native DNU edition** workflow or `npm run publish:shared` with server-only service-role credentials publishes to Supabase separately. The 01:00 and 13:00 collection schedule and manual workflow create drafts only. Shared publication and Outlook sending remain manual.

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

For a quick preview that does not clone or install the project, open the [GitHub Pages dashboard](https://buddhuza.github.io/dnu/). Visitors see the current shared edition and exports. Once the one-time trigger setup above is complete, the logged-in editor can open the scrape dialog, press **Scrape** to collect a new draft, then press **Publish**. Manual Add remains available.

## Test native collection without publishing

Use **Actions → Native collector integration check (draft only)** on the integration branch for a BBC-only run followed by a full run. On `main`, **Collect native DNU draft at 01:00 and 13:00 Vienna** runs at those times and can also be run manually; it uploads the completed JSON and places a review draft on GitHub Pages. Neither workflow publishes to Supabase or sends email. The source route audit in the JSON distinguishes checked and failed routes; article bodies are present only for successful full-text extractions.

## Manage the website

In local development, use **Manage site** in the top bar to edit the site title, show or hide page areas, rename and reorder sections, edit or hide stories and their summaries, add a story, add or hide news sources, and adjust light and dark palettes, font, and text size. The top bar also has a dark mode switch. Text starts at 18 px. Changes preview immediately and save to the current browser. The website header has no logo; the supplied Word template retains its OSCE logo. **Download** exports only the checked stories, each with the publisher's headline capitalisation preserved unless it is all caps, one factual summary sentence adding information beyond the headline, and the linked agency name, using the supplied Word template and including local edits. Its filename includes the coverage start and end in Vienna time, and the last page ends with the required disclaimer below a rule. The website shows the same disclaimer above its coverage note. Selecting a source on the left opens its website beside the update; publishers that block embedding can be opened with the direct link above the frame.

Press **Edit** beside **Download** in the update header to show a checkbox for every story. Press **Save** to return to the update with only checked stories visible. Reopen **Edit** to change the selection; it is saved in this browser, and Word downloads use the checked stories. In Edit mode, drag a story (or use its handle on a touch screen) to place it before or after another story, or drop it on a section, subsection, country heading, or empty target. Placement and order are saved in this browser and used by the Word download. The magnifying glass beside **Add** searches the visible update; use the arrow buttons or Enter to move between matching stories.

The **Import spreadsheet** button beside **Add** reads a DNU database export or a similar `.xlsx` or `.csv` file in your browser. It previews usable and skipped rows, then adds the stories to the current DNU. An imported URL already in the update refreshes that story; other stories and their edits remain. Available full article bodies are added to the browser and shared caches for later spreadsheet export. Use **Clear all stories** in Import when you want an empty update. Import uses no Firecrawl credits. In the logged-in shared editor, changes publish through Supabase for all visitors.

The spreadsheet icon between **Email** and **Search** exports the currently visible stories to an `.xlsx` workbook for database import. Columns are Date, Source, Region, Countries, Local Regions, Organizations, Themes, Types, Source URL, Heading, and Body. Region and the first Countries or Organizations entry follow each story's current heading in the update, including moves and Lead stories; other countries and organisations mentioned in the article follow. Optional fields without reliable data are blank. For native stories, full article bodies come directly from the completed JSON. The GitHub Pages build can include an `article-bodies.json` snapshot, and the browser also saves available bodies in IndexedDB. Missing bodies are reported and are not fetched through Firecrawl. If an article is unavailable, export continues with the others and shows the final counts and failed titles. Non-English articles that yield a verified English headline and summary are marked `(文A)` in the update; their spreadsheet body uses a full English translation when one is available.

To publish the prepared edition with its body cache, run `npm run build:pages:with-cache`, then `node scripts/sync-pages.mjs dist /path/to/gh-pages-worktree` and commit and push that worktree. The sync updates current files while retaining older hashed files in `assets/` so an already open browser tab can still load its Add dialog after a deployment. It also retains previously published article bodies when building the new snapshot, so older shared-edition exports remain available. Do not delete the old hashed assets during deployment. The generated `dist/article-bodies.json` is publicly accessible. It contains extracted article text, not Firecrawl credentials or the raw scrape cache. Rebuild it after changing `data/prepared-update.json` or any article-cache shard.

Press **Add** to enter an article URL, headline, agency and text manually. Manual edits and imports retain their existing Supabase publishing workflow; the native collector does not replace them.

Section headings default to uppercase 26 px text, with larger site and report titles. The report coverage date appears beneath **DAILY NEWS UPDATE** at headline text size. Change heading size, capitalization, width, section names and subsection lists in **Manage site**. The light palette uses a beige background. International Organisations appears under Miscellaneous. Source-list categories only organize outlets for browsing; international agencies can supply articles in any report section. The current lead section has four major Ukraine headlines and one Middle East headline; its topic is labeled **MIDDLE EAST**. Other headlines remain in their regional sections.

The manager's **Save & share** tab exports and imports a JSON settings file. Browser edits are private to that browser. To publish them for all visitors, replace `data/site-config.json` with the exported file, rebuild, and redeploy the site. The public site's default settings come from that file.

## Run locally

Use Node.js 24.5 or newer. Install the locked dependencies with npm ci, then start the Node API and Vite app with npm run dev. Open the Vite URL shown in the terminal. The API uses port 3001. For a built frontend, run npm run build and then NODE_ENV=production npm start.

Run DNU_TEST_DOMAIN=bbc.com npm run collect:daily first. It writes data/native-test-edition.json. Run npm run collect:daily without that variable for a full draft. The collector writes data/prepared-update.json through an atomic rename, leaving the earlier file intact if no article qualifies. Restarting the server is unnecessary: the API reads the completed file for each request. It serves stored full article text only where extraction succeeded.

For a local editor Collect button, configure the normal public Supabase URL and anon key in the browser build and set SUPABASE_URL and SUPABASE_ANON_KEY on the Node server. The server verifies the editor's access token; anonymous users cannot start collection. A local draft preview does not publish it to Supabase. Keep the service-role key only in the separate publication process.

Run npm test and npm run build before deployment. GitHub Actions collection runs twice daily and saves JSON drafts only. Shared publication and Outlook email remain disabled until reviewed.
