import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emailSubject, emailUpdateHtml } from '../src/emailUpdate.js';
import { displaySiteContent, normalizeSiteConfig } from '../src/siteConfig.js';
import { viennaSchedule } from '../src/weekendEdition.js';

export function outlookMessageFromState(state, now = new Date()) {
  const date = viennaSchedule(now).date;
  const edition = state?.edition;
  if (edition?.weekendAutomation?.date !== date || edition.weekendAutomation.status !== 'prepared' || edition.weekendAutomation.delivery !== 'windows') {
    throw new Error(`The published DNU has no prepared Windows Outlook edition for ${date}.`);
  }
  const settings = normalizeSiteConfig(state.settings, edition.articles || []);
  const excluded = new Set(state.excluded_story_ids || []);
  const articles = displaySiteContent(edition.articles || [], settings, excluded).filter(article => !excluded.has(article.id));
  if (!articles.length) throw new Error('The current weekend edition has no visible stories.');
  return {
    editionDate: date,
    revision: state.revision,
    articleCount: articles.length,
    subject: emailSubject(edition.checkedAt),
    html: emailUpdateHtml({ title: settings.updateTitle || edition.title, compiledAt: edition.checkedAt, articles, logoUrl: 'cid:dnu-osce-logo' })
  };
}

async function main() {
  const configPath = process.argv[2], outputPath = process.argv[3];
  if (!configPath || !outputPath) throw new Error('Usage: node windows-outlook-message.mjs CONFIG_JSON OUTPUT_JSON');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const base = new URL(config.supabaseUrl);
  if (base.protocol !== 'https:' || !base.hostname.endsWith('.supabase.co')) throw new Error('Set a valid HTTPS Supabase project URL in the Windows config.');
  const key = String(config.supabaseAnonKey || '').trim();
  if (!key || key.includes('PASTE_')) throw new Error('Set the public Supabase publishable key in the Windows config.');
  const endpoint = new URL('/rest/v1/dnu_state?id=eq.main&select=revision,edition,settings,excluded_story_ids', base);
  const response = await fetch(endpoint, {
    headers: { apikey: key, authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`Could not read the published DNU: HTTP ${response.status}.`);
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) throw new Error('The published DNU state is empty.');
  writeFileSync(outputPath, JSON.stringify(outlookMessageFromState(rows[0])), 'utf8');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
