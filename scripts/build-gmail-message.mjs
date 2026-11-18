import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emailSubject, emailUpdateHtml, emailUpdateText } from '../src/emailUpdate.js';
import { displaySiteContent, normalizeSiteConfig } from '../src/siteConfig.js';

export function gmailMessageFromState(state, expectedRevision, headlineOnly = false) {
  if (!Number.isSafeInteger(expectedRevision) || Number(state?.revision) !== expectedRevision)
    throw new Error('The published update changed before email delivery. No email was sent.');
  const edition = state?.edition;
  if (!Array.isArray(edition?.articles)) throw new Error('No published edition is available.');
  const settings = normalizeSiteConfig(state.settings, edition.articles);
  const excluded = new Set(state.excluded_story_ids || []);
  const articles = displaySiteContent(edition.articles, settings, excluded, edition.importedFromSpreadsheet === true)
    .filter(article => !excluded.has(article.id));
  if (!articles.length) throw new Error('The published update has no visible articles.');
  const content = {
    title: settings.updateTitle || edition.title,
    compiledAt: state.compiled_at || edition.checkedAt,
    articles, headlineOnly, logoUrl: 'cid:dnu-osce-logo'
  };
  return {
    revision: expectedRevision,
    articleCount: articles.length,
    subject: emailSubject(content.compiledAt),
    html: emailUpdateHtml(content),
    text: emailUpdateText(content)
  };
}

async function main() {
  const [revisionText, mode, outputPath] = process.argv.slice(2);
  const revision = Number(revisionText);
  if (!Number.isSafeInteger(revision) || !['true', 'false'].includes(mode) || !outputPath)
    throw new Error('Usage: build-gmail-message.mjs REVISION true|false OUTPUT_JSON');
  const key = process.env.DNU_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error('Set DNU_SUPABASE_PUBLISHABLE_KEY in GitHub Actions secrets.');
  const response = await fetch('https://epghsyajgspcywqqbfso.supabase.co/rest/v1/dnu_state?id=eq.main&select=revision,edition,settings,excluded_story_ids,compiled_at', {
    headers: { apikey: key, authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`Could not read the published update: HTTP ${response.status}.`);
  const state = (await response.json())?.[0];
  const message = gmailMessageFromState(state, revision, mode === 'true');
  writeFileSync(outputPath, JSON.stringify(message), { mode: 0o600 });
  console.log(`Prepared ${message.articleCount} published stories from revision ${revision}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
