import { createClient } from '@supabase/supabase-js';
import { reviewPublishedEdition } from '../src/editorialEdition.js';
import { displaySourceName } from '../src/sourceNames.js';
import { DEFAULT_GOOGLE_SHEET_URL, readGoogleSheetEdition } from '../src/googleSheetClient.js';
import { convertSpreadsheetRows } from '../src/spreadsheetImport.js';
import { resolveWeekendPlacementRows } from '../src/weekendPlacement.js';

const yahooHeadline = 'US military strikes cargo ship accused of violating Iran blockade';
const frenchCandidateHeadline = 'French presidential candidate pledges to enforce ICC arrest warrant for Netanyahu if elected';
async function googleTable(id, sheet) {
  const url = new URL(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq`);
  url.searchParams.set('sheet', sheet);
  url.searchParams.set('headers', '1');
  url.searchParams.set('tqx', 'out:json');
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Google worksheet ${sheet}: HTTP ${response.status}`);
  const text = await response.text();
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error(`Google worksheet ${sheet}: invalid response`);
  const result = JSON.parse(text.slice(start, end + 1));
  if (result.status !== 'ok' || !result.table) throw new Error(`Google worksheet ${sheet} is unavailable.`);
  return result.table;
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Shared edition publishing credentials are missing.');
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: state, error } = await client.from('dnu_state').select('revision,edition,settings').eq('id', 'main').single();
if (error) throw error;
if (state.edition?.weekendAutomation?.date !== '2026-11-08') throw new Error('The current edition is no longer the 8 November edition; no correction was published.');
let edition = state.edition;
for (const target of [{ headline: yahooHeadline, sourceName: 'dpa' }, { headline: frenchCandidateHeadline }]) {
  if (edition.articles.some(article => String(article.title || '').includes(target.headline))) continue;
  let sheet, row;
  for (const date of ['2026-11-09', '2026-11-08']) {
    const candidate = await readGoogleSheetEdition(process.env.DNU_GOOGLE_SHEET_URL || DEFAULT_GOOGLE_SHEET_URL, date, googleTable);
    if (candidate.date !== date) continue;
    row = candidate.rows.find(item => String(item.heading || '').includes(target.headline));
    if (row) { sheet = candidate; break; }
  }
  if (!row) throw new Error(`${target.headline} was not found in the 8 or 9 November worksheets. The shared edition was left unchanged.`);
  const converted = resolveWeekendPlacementRows([row], rows => convertSpreadsheetRows(rows));
  const restored = converted.articles.find(article => article.title.includes(target.headline));
  if (!restored) throw new Error(`${target.headline} could not be placed: ${JSON.stringify(converted.skipped)} ${JSON.stringify(converted.unplaced)}`);
  edition = { ...edition, articles: [...edition.articles, { ...restored, ...(target.sourceName ? { sourceName: target.sourceName } : {}) }] };
  console.log(`Restoring from ${sheet.sheetName}: ${restored.title} → ${restored.sectionId} / ${restored.subsection} / ${restored.country || ''}`);
}
const sourceCheckedArticles = [];
for (const article of edition.articles || []) {
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
const result = reviewPublishedEdition({ ...edition, articles: sourceCheckedArticles }, state.settings || {});
const officialCustom = (result.settings.customArticles || []).filter(article => /^(?:OSCE|osce\.org|Organisation for Security and Co-operation in Europe|president\.uz)$/i.test(String(article.sourceName || '').trim()) || /^(?:https:\/\/)?(?:www\.)?(?:osce\.org|president\.uz)(?:\/|$)/i.test(String(article.url || '')) || /^Swiss Federal Councillor and 2026 OSCE Chairman-in/i.test(String(article.title || '')) || /^(?:With Change of Power, Serbia Can Reinvigorate EU Accession Bid|Attempts to find resolution for Israel['’]s new government and Ukraine['’]s war|How a university boom fuels exploitation and human trafficking|Motorcyclists account for 38% of Cyprus road deaths)/i.test(String(article.title || '')) || /\b(?:ban on single-use plastic tableware|Diwali celebrated in Bishkek|school bus accident|child sex abuse)\b/i.test(String(article.title || '')));
if (officialCustom.length) {
  const removedIds = new Set(officialCustom.map(article => article.id));
  result.settings = {
    ...result.settings,
    customArticles: result.settings.customArticles.filter(article => !removedIds.has(article.id)),
    articleEdits: Object.fromEntries(Object.entries(result.settings.articleEdits || {}).filter(([id]) => !removedIds.has(id))),
    articleOrder: (result.settings.articleOrder || []).filter(id => !removedIds.has(id)),
    leadOrigins: Object.fromEntries(Object.entries(result.settings.leadOrigins || {}).filter(([id]) => !removedIds.has(id)))
  };
  for (const article of officialCustom) console.log(`Removed editor-specified manually added story: ${article.sourceName} — ${article.title}`);
}
for (const article of result.removed) console.log(`Removed: ${article.sourceName} — ${article.title} — ${article.reason}`);
for (const article of result.moved) console.log(`Moved: ${article.sourceName} — ${article.title} → ${article.placement.sectionId} / ${article.placement.subsection} / ${article.placement.country || ''}`);
for (const article of [...result.edition.articles, ...(result.settings.customArticles || [])]) {
  if (/Tokayev outlines key areas|Baku['’]s joy is Ankara['’]s pride|Trump says strikes unlikely if peace talks keep moving|How a university boom fuels exploitation/i.test(article.title || ''))
    console.log(`Placement audit: ${article.sourceName} — ${article.title} → ${article.sectionId || article.section} / ${article.subsection || ''} / ${article.country || ''}`);
}
if (!result.edition.articles.length) throw new Error('The correction would empty the edition; no change was published.');
const changed = result.removed.length || result.moved.length || officialCustom.length || result.edition.articles.length !== state.edition.articles.length || result.edition.articles.some((article, index) => article.title !== state.edition.articles[index]?.title || article.sourceName !== state.edition.articles[index]?.sourceName);
if (!changed) { console.log('The shared edition already reflects these corrections.'); process.exit(0); }
const { data: saved, error: saveError } = await client.from('dnu_state')
  .update({ edition: result.edition, settings: result.settings, revision: Number(state.revision) + 1, updated_at: new Date().toISOString() })
  .eq('id', 'main').eq('revision', state.revision).select('revision').maybeSingle();
if (saveError) throw saveError;
if (!saved) throw new Error('The shared edition changed during review; no correction was published.');
console.log(`Published corrected shared edition: ${result.edition.articles.length} stories retained, ${result.removed.length} removed.`);
