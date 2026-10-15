import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectFeed, collectFallbackFeed, FEED_URLS } from '../server/feeds.js';
import { articleArray, DEFAULT_INCLUDE, fallbackListingUrl, scrapeHeadlines, scrapeImportedArticle, searchSourceArticles, reviewedArticleCheck, shortlistCandidates, undatedCandidates } from '../server/news.js';
import { articlePlacement } from '../server/importArticle.js';
import { IMPORT_PROMPT } from '../src/importPrompt.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const sources = JSON.parse(readFileSync(join(root, 'sources.json'), 'utf8'));
const checkpointPath = process.env.COLLECTION_CHECKPOINT || join(root, 'data/collection-2026-10-14-working.json');
const start = Date.parse('2026-10-14T00:00:00Z'); // 14 October, 02:00 in Vienna
const end = Date.parse('2026-10-15T00:00:00Z'); // 15 October, 02:00 in Vienna
const key = process.env.FIRECRAWL_API_KEY;
if (!key) throw new Error('FIRECRAWL_API_KEY is not set');
const state = existsSync(checkpointPath) ? JSON.parse(readFileSync(checkpointPath, 'utf8')) : {
  windowStart: new Date(start).toISOString(), windowEnd: new Date(end).toISOString(), startedAt: new Date().toISOString(), sources: {}
};
const save = () => writeFileSync(checkpointPath, JSON.stringify(state, null, 2));
const inWindow = value => { const time = Date.parse(value); return Number.isFinite(time) && time >= start && time < end; };
const topical = text => /\b(?:OSCE|secur\w*|war|conflict\w*|terror\w*|militar\w*|defen[cs]\w*|border\w*|sanction\w*|diploma\w*|cooperat\w*|foreign|minister\w*|president\w*|government\w*|parliament\w*|election\w*|party|summit\w*|talks|treaty|peace|ceasefire\w*|NATO|European Union|EU|United Nations|UN|Russia\w*|Ukraine|Ukrainian|Iran\w*|Israel\w*|Gaza|Caucasus|Central Asia|missile\w*|drone\w*|arms|weapons|protest\w*|intelligence|ambassador\w*|negotiat\w*|invas\w*|attack\w*|coup|referendum|alliance\w*)\b/i.test(text);

function candidateList(payload, source) {
  const candidates = undatedCandidates(payload, source, [], [], true);
  const listedTimes = new Map(articleArray(payload).map(raw => [String(raw.url || raw.absoluteUrl || raw.link || ''), String(raw.publishedAt || raw.published_at || raw.date || '')]));
  return candidates.filter(item => {
    const listed = listedTimes.get(item.url) || '';
    const time = Date.parse(listed);
    return !Number.isFinite(time) || inWindow(listed);
  });
}

async function batchArticlePages(urls) {
  if (!urls.length) return [];
  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  let created;
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch('https://api.firecrawl.dev/v2/batch/scrape', {
      method: 'POST', headers,
      body: JSON.stringify({ urls, formats: ['markdown', 'html', { type: 'json', prompt: IMPORT_PROMPT }], onlyMainContent: true, timeout: 30000 }),
      signal: AbortSignal.timeout(45000)
    });
    created = await response.json();
    if (response.ok && created.id) break;
    if (response.status !== 429 || attempt === 2) throw new Error(created.error || `Firecrawl batch returned HTTP ${response.status}`);
    await new Promise(resolve => setTimeout(resolve, 15000));
  }
  const results = new Map();
  const url = `https://api.firecrawl.dev/v2/batch/scrape/${created.id}`;
  for (let attempt = 0; attempt < 45; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 4000));
    const response = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(45000) });
    const status = await response.json();
    if (!response.ok) throw new Error(status.error || `Firecrawl batch status HTTP ${response.status}`);
    for (const page of status.data || []) {
      const sourceUrl = page.metadata?.sourceURL || page.metadata?.url;
      if (sourceUrl) results.set(sourceUrl, page);
    }
    if (status.status === 'completed' || status.completed >= status.total) return urls.map(item => results.get(item) || null);
    if (status.status === 'failed') throw new Error(status.error || 'Firecrawl batch failed');
  }
  throw new Error(`Firecrawl batch ${created.id} timed out after three minutes`);
}

async function examineCandidates(source, record, payload, method) {
  const candidates = candidateList(payload, source);
  const selected = process.env.COLLECTION_DEEP === '1' ? candidates : shortlistCandidates(candidates);
  const attempt = { method, listed: articleArray(payload).length, candidates: candidates.length, selected: selected.length, fetched: 0, accepted: 0, rejected: {}, errors: [] };
  attempt.listedArticles = articleArray(payload).map(item => ({ title: item.title || item.headline, url: item.url || item.link, publishedAt: item.publishedAt || item.date })).slice(0, 100);
  record.attempts.push(attempt);
  save();
  const unchecked = selected.filter(candidate => !record.checkedUrls.includes(candidate.url));
  for (let offset = 0; offset < unchecked.length; offset += 10) {
    const group = unchecked.slice(offset, offset + 10);
    let pages;
    try { pages = await batchArticlePages(group.map(item => item.url)); }
    catch (error) {
      attempt.errors.push(`Batch: ${error.message}`);
      if (/credit|quota|payment required/i.test(error.message)) { save(); throw error; }
      pages = [];
      for (const candidate of group) {
        try { pages.push((await scrapeImportedArticle(candidate.url, key)).data); }
        catch (pageError) { pages.push(null); attempt.errors.push(`${candidate.url}: ${pageError.message}`); }
      }
    }
    for (let index = 0; index < group.length; index++) {
      const candidate = group[index];
      const data = pages[index];
      attempt.fetched++;
      if (!data) { attempt.rejected.pageError = (attempt.rejected.pageError || 0) + 1; save(); continue; }
      const page = { data };
      record.checkedUrls.push(candidate.url);
      try {
      const check = reviewedArticleCheck(page, source, candidate.url, end);
      if (!check.article) { attempt.rejected[check.reason] = (attempt.rejected[check.reason] || 0) + 1; save(); continue; }
      if (!inWindow(check.article.publishedAt)) { attempt.rejected.outsideRequestedWindow = (attempt.rejected.outsideRequestedWindow || 0) + 1; save(); continue; }
      const extracted = typeof page.data?.json === 'string' ? JSON.parse(page.data.json) : page.data?.json || {};
      if (!topical(`${check.article.title} ${check.article.summary}`)) { attempt.rejected.outsideScope = (attempt.rejected.outsideScope || 0) + 1; save(); continue; }
      const placement = articlePlacement(extracted, check.article.title, check.article.summary);
      const article = { ...check.article, section: placement?.sectionId || '', subsection: placement?.subsection || '', country: placement?.country || '', reviewed: true };
      record.articles.push(article);
      attempt.accepted++;
    } catch (error) {
      attempt.rejected.pageError = (attempt.rejected.pageError || 0) + 1;
      if (attempt.errors.length < 5) attempt.errors.push(`${candidate.url}: ${error.message}`);
      if (/credit|quota|payment required/i.test(error.message)) { save(); throw error; }
    }
    save();
    console.log(`${source.id} ${source.name}: ${method} ${attempt.fetched}/${selected.length} selected pages, ${record.articles.length} relevant`);
    }
  }
}

async function scan(source) {
  const record = state.sources[source.id] ??= { id: source.id, name: source.name, group: source.group, url: source.url, status: 'running', attempts: [], checkedUrls: [], articles: [], errors: [] };
  if (record.status === 'complete') return;
  console.log(`SOURCE ${source.id} ${source.name} ${source.url}`);
  const strategies = [
    ['publisher feed', async () => collectFeed(source)],
    ['primary Firecrawl listing', async () => scrapeHeadlines(source, DEFAULT_INCLUDE, key)],
    ['alternate feed', async () => collectFallbackFeed(source, fetch, () => true)],
    ['alternate Firecrawl listing', async () => { const url = fallbackListingUrl(source); return url ? scrapeHeadlines({ ...source, listingUrl: url }, DEFAULT_INCLUDE, key) : null; }],
    ['Firecrawl site search', async () => searchSourceArticles(source, DEFAULT_INCLUDE, key)]
  ];
  for (const [method, collect] of strategies) {
    if (method === 'primary Firecrawl listing' && record.articles.length) break;
    if (method !== 'publisher feed' && method !== 'primary Firecrawl listing' && record.articles.length) break;
    if (record.attempts.some(attempt => attempt.method === method && attempt.finished)) continue;
    try {
      const payload = await collect();
      if (!payload) { record.attempts.push({ method, finished: true, listed: 0, candidates: 0, fetched: 0, accepted: 0, reason: 'No usable feed or listing' }); save(); continue; }
      await examineCandidates(source, record, payload, method);
      record.attempts.at(-1).finished = true;
    } catch (error) {
      record.errors.push(`${method}: ${error.message}`);
      const attempt = record.attempts.at(-1);
      if (attempt?.method === method) attempt.finished = true;
      else record.attempts.push({ method, finished: true, error: error.message });
      if (/credit|quota|payment required/i.test(error.message)) { save(); throw error; }
    }
    save();
  }
  record.articles = [...new Map(record.articles.map(item => [item.url, item])).values()];
  record.status = 'complete';
  record.completedAt = new Date().toISOString();
  save();
  console.log(`DONE ${source.id} ${source.name}: ${record.articles.length} relevant, ${record.checkedUrls.length} pages checked`);
}

const selected = process.env.COLLECTION_SOURCE_IDS ? new Set(process.env.COLLECTION_SOURCE_IDS.split(',').map(value => value.trim())) : null;
const ordered = [sources.find(source => source.id === 'source-32'), ...sources.filter(source => source.id !== 'source-32' && FEED_URLS[source.id]), ...sources.filter(source => source.id !== 'source-32' && !FEED_URLS[source.id])].filter(source => source && (!selected || selected.has(source.id)));
for (const source of ordered) await scan(source);
console.log(`COMPLETE ${Object.keys(state.sources).length}/${sources.length} sources, ${Object.values(state.sources).reduce((sum, record) => sum + record.articles.length, 0)} relevant articles`);
