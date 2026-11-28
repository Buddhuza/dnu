# Use DNU from another ChatGPT account

This guide is for the same owner using a second ChatGPT/Codex account. The accounts can work on the same DNU repository and live edition. Chat history and Codex cloud environment settings do not move with the repository.

## Connect the project

1. Sign in to the other ChatGPT account and connect its GitHub integration to the GitHub identity that can write to `Buddhuza/dnu`. If the corporate account blocks GitHub connections or external network access, its workspace administrator must allow them.
2. Open `Buddhuza/dnu` as a Codex cloud repository, using the latest `main` branch. Read `AGENTS.md`, `public/dnu-rules.md` and this guide before editing. These files carry the working and editorial rules; the old chat is useful context but is not required to operate the app.
3. Use Node.js 24.5 or newer. In `/workspace/dnu`, run `npm ci`, `npm test` and `npm run build`. For a local preview, run `npm run dev`; the Vite site is on port 5173 and the optional Node API is on port 3001. The published website is served from GitHub Pages; the shared articles, user accounts and editor changes are in the existing Supabase project.

## Configure the new Codex cloud environment

Create these bindings in the *new account's* cloud environment settings. Enter secret values in that settings UI, never in chat, committed files or a browser build. The previous account's cloud environment bindings are not automatically copied.

| Name | Purpose | Where to get the value |
| --- | --- | --- |
| `SUPABASE_URL` | Existing DNU project API URL; safe to configure as a plain environment variable | Supabase project settings → API |
| `SUPABASE_ACCESS_TOKEN` | Deploy and inspect Supabase functions | Create a **new personal token** in the corporate account's Supabase account settings |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side publication and admin scripts | Existing DNU project settings → API Keys; keep it server-side |
| `DNU_TEMP_PASSWORD` | Only if intentionally running `npm run editors:create` to set the four editor passwords | Choose a fresh temporary password when needed; routine development does not need this binding |
| `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` | Local browser build and editor login | Existing project's public URL and publishable/anon key in Supabase project settings → API Keys |

The existing project URL is `https://epghsyajgspcywqqbfso.supabase.co`. `VITE_SUPABASE_ANON_KEY` is a public browser key; **never** put `SUPABASE_SERVICE_ROLE_KEY` in a `VITE_` variable. If the environment already supplies `SUPABASE_URL`, use that binding instead of adding a duplicate name.

For a restricted cloud network, allow `api.supabase.com` and `epghsyajgspcywqqbfso.supabase.co`. GitHub access must also be enabled through the account's GitHub connection. Package installation needs the usual npm registry access. The native collector uses direct publisher websites and Google News RSS, so a full local collection also needs outbound access to those sites. Firecrawl and Google Sheets credentials are **not** required for the native collector.

## What is already shared

- The `Buddhuza/dnu` repository and its GitHub Actions schedules, draft artifacts and deployment workflows are shared by repository access. Existing Actions secrets (`DNU_WORKFLOW_TOKEN`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `GMAIL_APP_PASSWORD`) remain attached to that repository. GitHub does not reveal their stored values, but authorized workflows can use them. There is no need to recreate them just to use the second ChatGPT account.
- Supabase Auth users, published stories, article cache, address book, editorial learning and Edge Function secrets belong to the existing Supabase project. Opening it from another account does not create a separate edition.
- The sender Gmail app password is held by GitHub Actions for the automated and button-triggered email workflows. It is not needed in the new Codex environment for those workflows, and Google will not show the existing app password again.
- If a GitHub or Supabase token expires, replace its repository or cloud-environment binding through the corresponding settings page. A new personal Supabase token for the corporate account does not automatically replace the repository's Actions secret.

## Check that access works

1. Confirm the new account can fetch and push a small non-production change to `Buddhuza/dnu` on a branch. A successful clone alone does not prove write access.
2. Confirm it can open the DNU Supabase project and inspect its Edge Functions. Do not run `editors:create` as a setup test: that script changes passwords.
3. Run the app's tests and build. Open a local preview and confirm the shared edition loads. Test any publication or email change separately with the intended live workflow; local build success does not prove remote deployment.

Sharing a ChatGPT conversation link provides context only. It does not transfer GitHub or Supabase permissions, cloud environment secret bindings, or the ability to run the workflows.
