import { createClient } from '@supabase/supabase-js';
import { reviewPublishedEdition } from '../src/editorialEdition.js';
import { displaySourceName } from '../src/sourceNames.js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Shared edition publishing credentials are missing.');
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: state, error } = await client.from('dnu_state').select('revision,edition,settings').eq('id', 'main').single();
if (error) throw error;
if (state.edition?.weekendAutomation?.date !== '2026-11-08') throw new Error('The current edition is no longer the 8 November edition; no correction was published.');
const sourceCheckedArticles = [];
for (const article of state.edition.articles || []) {
  if (/politico\.eu/i.test(article.title || '') && /^\s*[-–]/.test(article.title || '')) console.log(`Inspected source-list title: ${article.title}`);
  if (/^Yahoo(?: News|\.com)?$/i.test(article.sourceName || '')) {
    const { data: body } = await client.from('dnu_bodies').select('body').eq('url', article.url).maybeSingle();
    const cachedCredit = /\b(?:dpa|Deutsche Presse-Agentur)\b/i.test(String(body?.body || ''));
    const credited = displaySourceName(article.sourceName, { body: body?.body || '', title: article.title });
    console.log(`Yahoo attribution check: ${article.title} — ${article.url} — cached dpa credit: ${cachedCredit}; editor-confirmed dpa story: ${credited === 'dpa' && !cachedCredit}`);
    sourceCheckedArticles.push(credited === 'dpa' ? { ...article, sourceName: 'dpa' } : article);
  } else {
    sourceCheckedArticles.push(article);
  }
}
const result = reviewPublishedEdition({ ...state.edition, articles: sourceCheckedArticles }, state.settings || {});
for (const article of result.removed) console.log(`Removed: ${article.sourceName} — ${article.title} — ${article.reason}`);
if (!result.edition.articles.length) throw new Error('The correction would empty the edition; no change was published.');
const changed = result.removed.length || result.edition.articles.some((article, index) => article.title !== state.edition.articles[index]?.title || article.sourceName !== state.edition.articles[index]?.sourceName);
if (!changed) { console.log('The shared edition already reflects these corrections.'); process.exit(0); }
const { data: saved, error: saveError } = await client.from('dnu_state')
  .update({ edition: result.edition, settings: result.settings, revision: Number(state.revision) + 1, updated_at: new Date().toISOString() })
  .eq('id', 'main').eq('revision', state.revision).select('revision').maybeSingle();
if (saveError) throw saveError;
if (!saved) throw new Error('The shared edition changed during review; no correction was published.');
console.log(`Published corrected shared edition: ${result.edition.articles.length} stories retained, ${result.removed.length} removed.`);
