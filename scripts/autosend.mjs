import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { latestCollectionArticles } from '../src/editionActions.js';
import { extendSiteConfigForImportedPlacements, normalizeSiteConfig } from '../src/siteConfig.js';
import { gmailMessageFromState } from './build-gmail-message.mjs';
import { ensureUkraineWarLeads } from '../src/weekendEdition.js';

const supabaseUrl = 'https://epghsyajgspcywqqbfso.supabase.co';

export function autosendEdition(draft, status, settings, requiredDate = '') {
  if (draft?.nativeEdition !== true || !draft.checkedAt || !Array.isArray(draft.articles) || !draft.articles.length ||
      status?.checkedAt !== draft.checkedAt || status?.stories !== draft.articles.length || !Number.isSafeInteger(status?.runId))
    throw new Error('The latest completed scrape is missing or does not match its status. The shared update was not changed.');
  if (requiredDate) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date(draft.checkedAt)).map(part => [part.type, part.value]));
    const collectedDate = `${parts.year}-${parts.month}-${parts.day}`;
    if (collectedDate < requiredDate.slice(0, 10) || collectedDate === requiredDate.slice(0, 10) && Number(parts.hour) < 1)
      throw new Error(`The latest scrape is older than the ${requiredDate.slice(0, 10)} Vienna morning. No shared stories were cleared or emailed; AUTOSEND will retry.`);
  }
  const leadSelection = ensureUkraineWarLeads(latestCollectionArticles(draft), draft.leadOrigins);
  const incoming = leadSelection.articles;
  if (!incoming.length) throw new Error('The latest scrape has no stories to publish. The shared update was not changed.');
  const articles = incoming.map(({ body, ...article }) => article);
  const edition = { ...draft, articles, leadOrigins: leadSelection.leadOrigins, emptyPrepared: false, importedFromSpreadsheet: false,
    importedFileName: '', latestCollectionArticleUrls: articles.map(article => article.url) };
  const nextSettings = extendSiteConfigForImportedPlacements(normalizeSiteConfig({
    ...settings, version: 1, showUpdate: true, customArticles: [], articleEdits: {}, articleOrder: [],
    leadOrigins: leadSelection.leadOrigins
  }, articles), articles);
  const bodies = incoming.filter(article => article.url && String(article.body || '').trim()).map(article => ({
    url: article.url, heading: article.originalHeadline || article.title || '', body: article.body,
    translated: article.translated === true
  }));
  return { edition, settings: nextSettings, bodies };
}

async function serviceRoleKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error('Set SUPABASE_ACCESS_TOKEN or SUPABASE_SERVICE_ROLE_KEY in GitHub Actions secrets.');
  const response = await fetch('https://api.supabase.com/v1/projects/epghsyajgspcywqqbfso/api-keys', {
    headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`Could not retrieve the Supabase publishing key (HTTP ${response.status}).`);
  const key = (await response.json()).find(item => item.name === 'service_role')?.api_key;
  if (!key) throw new Error('The Supabase project has no service-role key available.');
  return key;
}

export async function autosend(draft, status, client) {
  const { data: current, error: readError } = await client.from('dnu_state')
    .select('revision,edition,settings,excluded_story_ids').eq('id', 'main').single();
  if (readError) throw readError;
  const next = autosendEdition(draft, status, current.settings);
  if (next.bodies.length) {
    const { error } = await client.from('dnu_bodies').upsert(next.bodies, { onConflict: 'url' });
    if (error) throw error;
  }
  const { data: saved, error: saveError } = await client.from('dnu_state').update({
    revision: Number(current.revision) + 1, edition: next.edition, settings: next.settings,
    excluded_story_ids: [], compiled_at: draft.checkedAt, updated_at: new Date().toISOString()
  }).eq('id', 'main').eq('revision', current.revision).select('revision').maybeSingle();
  if (saveError) throw saveError;
  if (!saved) throw new Error('Another editor changed the update. No email was sent; run autosend again.');
  const message = gmailMessageFromState({ revision: Number(saved.revision), edition: next.edition,
    settings: next.settings, excluded_story_ids: [], compiled_at: draft.checkedAt }, Number(saved.revision), true);
  return { message, storyCount: next.edition.articles.length, cachedBodies: next.bodies.length };
}

async function main() {
  const [draftPath, statusPath, outputPath] = process.argv.slice(2);
  if (!draftPath || !statusPath || !outputPath) throw new Error('Usage: autosend.mjs DRAFT_JSON STATUS_JSON MESSAGE_JSON');
  const draft = JSON.parse(readFileSync(draftPath, 'utf8'));
  const status = JSON.parse(readFileSync(statusPath, 'utf8'));
  autosendEdition(draft, status, {}, process.env.DNU_REQUIRED_COLLECTION_DATE || ''); // Validate before connecting to the shared database.
  const client = createClient(supabaseUrl, await serviceRoleKey(), { auth: { persistSession: false, autoRefreshToken: false } });
  const result = await autosend(draft, status, client);
  writeFileSync(outputPath, JSON.stringify(result.message), { mode: 0o600 });
  console.log(`Cleared the old edition and published ${result.storyCount} latest-scrape stories in revision ${result.message.revision}; cached ${result.cachedBodies} article bodies. Ready to email ${result.message.recipients.length} saved recipients.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
