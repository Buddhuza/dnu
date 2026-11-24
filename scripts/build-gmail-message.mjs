import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emailSubject, emailUpdateHtml, emailUpdateText } from '../src/emailUpdate.js';
import { displaySiteContent, normalizeSiteConfig } from '../src/siteConfig.js';

export function gmailMessageFromState(state, expectedRevision, headlineOnly = false, recipients = null) {
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
    recipients: recipients ?? settings.gmailRecipients,
    subject: `[TEST] ${emailSubject(content.compiledAt)}`,
    html: emailUpdateHtml(content),
    text: emailUpdateText(content)
  };
}

async function main() {
  const [revisionText, mode, outputPath] = process.argv.slice(2);
  const revision = Number(revisionText);
  if (!(revisionText === 'latest' || Number.isSafeInteger(revision)) || !['true', 'false'].includes(mode) || !outputPath)
    throw new Error('Usage: build-gmail-message.mjs REVISION|latest true|false OUTPUT_JSON');
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key && process.env.SUPABASE_ACCESS_TOKEN) {
    const keysResponse = await fetch('https://api.supabase.com/v1/projects/epghsyajgspcywqqbfso/api-keys', {
      headers: { authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` }, signal: AbortSignal.timeout(20_000)
    });
    if (!keysResponse.ok) throw new Error(`Could not retrieve the Supabase service key: HTTP ${keysResponse.status}.`);
    key = (await keysResponse.json()).find(item => item.name === 'service_role')?.api_key;
  }
  if (!key) throw new Error('Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ACCESS_TOKEN in GitHub Actions secrets.');
  const response = await fetch('https://epghsyajgspcywqqbfso.supabase.co/rest/v1/dnu_state?id=eq.main&select=revision,edition,settings,excluded_story_ids,compiled_at', {
    headers: { apikey: key, authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`Could not read the published update: HTTP ${response.status}.`);
  const state = (await response.json())?.[0];
  const publishedRevision = revisionText === 'latest' ? Number(state?.revision) : revision;
  const recipientResponse = await fetch('https://epghsyajgspcywqqbfso.supabase.co/rest/v1/dnu_address_book?selected=eq.true&select=email&order=email&limit=401', {
    headers: { apikey: key, authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20_000)
  });
  if (!recipientResponse.ok) throw new Error(`Could not read the private address book: HTTP ${recipientResponse.status}.`);
  const recipients = (await recipientResponse.json()).map(item => item.email);
  if (!recipients.length || recipients.length > 400) throw new Error('Choose between 1 and 400 BCC recipients in the address book.');
  const message = gmailMessageFromState(state, publishedRevision, mode === 'true', recipients);
  writeFileSync(outputPath, JSON.stringify(message), { mode: 0o600 });
  console.log(`Prepared ${message.articleCount} published stories from revision ${publishedRevision}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
