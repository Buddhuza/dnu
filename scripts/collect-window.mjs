import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectFeed, collectFallbackFeed, FEED_URLS } from '../server/feeds.js';
import { articleArray, DEFAULT_INCLUDE, fallbackListingUrl, scrapeHeadlines, searchSourceArticles, reviewedArticleCheck, shortlistCandidates, undatedCandidates } from '../server/news.js';
import { articlePlacement } from '../server/importArticle.js';
import { IMPORT_PROMPT } from '../src/importPrompt.js';
import { createAutoScrapeHistory } from '../server/autoScrapeHistory.js';
import { createArticleCache } from '../server/articleCache.js';
import { passesSourcePolicy } from '../server/editorialPolicy.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const sources = JSON.parse(readFileSync(join(root, 'sources.json'), 'utf8'));
const collectionDay = process.env.COLLECTION_DAY || new Date().toISOString().slice(0, 10);
const runId = process.env.COLLECTION_RUN_ID || collectionDay;
const checkpointPath = process.env.COLLECTION_CHECKPOINT || join(root, `data/collection-${runId}-working.json`);
const existingState = existsSync(checkpointPath) ? JSON.parse(readFileSync(checkpointPath, 'utf8')) : null;
const requestedEnd = process.env.COLLECTION_WINDOW_END ? Date.parse(process.env.COLLECTION_WINDOW_END) : existingState ? Date.parse(existingState.windowEnd) : Date.now();
const requestedStart = process.env.COLLECTION_WINDOW_START ? Date.parse(process.env.COLLECTION_WINDOW_START) : existingState ? Date.parse(existingState.windowStart) : requestedEnd - 24 * 60 * 60 * 1000;
if (!Number.isFinite(requestedStart) || !Number.isFinite(requestedEnd) || requestedStart >= requestedEnd) throw new Error('Invalid collection window');
const key = process.env.FIRECRAWL_API_KEY;
if (!key) throw new Error('FIRECRAWL_API_KEY is not set');
const scrapeHistory = createAutoScrapeHistory(join(root, 'data/auto-scrape-history.jsonl'));
const articleCache = createArticleCache(join(root, 'data/article-cache.jsonl'));
const batchId = process.env.COLLECTION_BATCH_ID || `window-${new Date().toISOString()}`;
const phase = process.env.COLLECTION_PHASE || 'all';
const state = existingState || {
  windowStart: new Date(requestedStart).toISOString(), windowEnd: new Date(requestedEnd).toISOString(), startedAt: new Date().toISOString(), sources: {}
};
const start = Date.parse(state.windowStart);
const end = Date.parse(state.windowEnd);
if (start !== requestedStart || end !== requestedEnd) throw new Error('Collection checkpoint window differs from requested window');
const save = () => writeFileSync(checkpointPath, JSON.stringify(state, null, 2));
const inWindow = value => { const time = Date.parse(value); return Number.isFinite(time) && time >= start && time < end; };
const topical = text => /\b(?:OSCE|secur\w*|war|conflict\w*|terror\w*|militar\w*|defen[cs]\w*|border\w*|sanction\w*|diploma\w*|cooperat\w*|foreign|minister\w*|president\w*|government\w*|parliament\w*|election\w*|party|summit\w*|talks|treaty|peace|ceasefire\w*|NATO|European Union|EU|United Nations|UN|Russia\w*|Ukraine|Ukrainian|Iran\w*|Israel\w*|Gaza|Caucasus|Central Asia|missile\w*|drone\w*|arms|weapons|protest\w*|intelligence|ambassador\w*|negotiat\w*|invas\w*|attack\w*|coup|referendum|alliance\w*)\b/i.test(text);

function candidateList(payload, source) {
  const candidates = undatedCandidates(payload, source, [], [], true);
  const listedTimes = new Map(articleArray(payload).map(raw => [String(raw.url || raw.absoluteUrl || raw.link || ''), String(raw.publishedAt || raw.published_at || raw.date || '')]));
  return candidates.filter(item => {
    const listed = listedTimes.get(item.url) || '';
    const time = Date.parse(listed);
    return !Number.isFinite(time) || /T00:00:00(?:\.000)?Z$/i.test(listed) || inWindow(listed);
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
  const attempt = { method, listed: articleArray(payload).length, candidates: candidates.length, previouslyScraped: 0, selected: selected.length, fetched: 0, reused: 0, accepted: 0, rejected: {}, errors: [] };
  attempt.listedArticles = articleArray(payload).map(item => ({ title: item.title || item.headline, url: item.url || item.link, publishedAt: item.publishedAt || item.date })).slice(0, 100);
  record.attempts.push(attempt);
  save();
  const unchecked = selected.filter(candidate => !record.checkedUrls.includes(candidate.url));
  for (let offset = 0; offset < unchecked.length; offset += 10) {
    const group = unchecked.slice(offset, offset + 10);
    const fetchGroup = [];
    const cached = new Map();
    for (const candidate of group) {
      const entry = articleCache.get(candidate.url);
      if (entry?.article || entry?.page) {
        cached.set(candidate.url, entry);
        attempt.reused++;
        attempt.previouslyScraped++;
      } else if (entry?.retryAfter > Date.now()) {
        cached.set(candidate.url, entry);
        attempt.previouslyScraped++;
      } else {
        // Legacy history records an attempt, not a successful page fetch. Recover it once.
        await scrapeHistory.claim(candidate, { batchId, sourceId: source.id, force: true });
        fetchGroup.push(candidate);
      }
    }
    let pages;
    try { pages = await batchArticlePages(fetchGroup.map(item => item.url)); }
    catch (error) {
      attempt.errors.push(`Batch: ${error.message}`);
      if (/credit|quota|payment required/i.test(error.message)) { save(); throw error; }
      pages = fetchGroup.map(() => null);
    }
    const fetched = new Map(fetchGroup.map((candidate, index) => [candidate.url, pages[index]]));
    for (const candidate of group) {
      const data = fetched.get(candidate.url);
      const entry = cached.get(candidate.url);
      if (fetched.has(candidate.url)) attempt.fetched++;
      record.checkedUrls.push(candidate.url);
      if (!data && !entry?.page && !entry?.article) {
        if (fetched.has(candidate.url)) articleCache.putFailure(candidate.url);
        attempt.rejected.pageError = (attempt.rejected.pageError || 0) + 1;
        save();
        continue;
      }
      if (data) articleCache.putPage(candidate.url, data);
      const page = entry?.page ? { data: entry.page } : { data };
      try {
        let article = entry?.article;
        if (!article) {
          const check = reviewedArticleCheck(page, source, candidate.url, end);
          if (!check.article) { attempt.rejected[check.reason] = (attempt.rejected[check.reason] || 0) + 1; save(); continue; }
          const extracted = typeof page.data?.json === 'string' ? JSON.parse(page.data.json) : page.data?.json || {};
          const placement = articlePlacement(extracted, check.article.title, check.article.summary);
          article = { ...check.article, section: placement?.sectionId || '', subsection: placement?.subsection || '', country: placement?.country || '', reviewed: true };
          articleCache.putArticle(candidate.url, article);
        }
        if (!inWindow(article.publishedAt)) { attempt.rejected.outsideRequestedWindow = (attempt.rejected.outsideRequestedWindow || 0) + 1; save(); continue; }
        if (!topical(`${article.title} ${article.summary}`) || !passesSourcePolicy(source, article.title, article.summary)) { attempt.rejected.outsideScope = (attempt.rejected.outsideScope || 0) + 1; save(); continue; }
        record.articles.push(article);
        attempt.accepted++;
    } catch (error) {
      attempt.rejected.pageError = (attempt.rejected.pageError || 0) + 1;
      if (attempt.errors.length < 5) attempt.errors.push(`${candidate.url}: ${error.message}`);
      if (/credit|quota|payment required/i.test(error.message)) { save(); throw error; }
    }
    save();
    console.log(`${source.id} ${source.name}: ${method} ${attempt.fetched} fetched, ${attempt.reused} reused, ${record.articles.length} relevant`);
    }
  }
}

async function scan(source) {
  const record = state.sources[source.id] ??= { id: source.id, name: source.name, group: source.group, url: source.url, status: 'running', attempts: [], checkedUrls: [], articles: [], errors: [] };
  if (record.status === 'complete' && phase !== 'supplement' && !(phase === 'fallback' && !record.articles.length)) return;
  if (phase === 'fallback' && record.status !== 'primaryComplete' && !(record.status === 'complete' && !record.articles.length)) return;
  if (phase === 'supplement' && (!FEED_URLS[source.id] || record.attempts.some(attempt => attempt.method === 'primary Firecrawl listing' && attempt.finished))) return;
  console.log(`SOURCE ${source.id} ${source.name} ${source.url}`);
  const cachedListing = async (filename = `listings-${runId}.json`) => {
    for (let retry = 0; retry < 150; retry++) {
      const file = join(root, 'data', filename);
      let listings = {};
      try { if (existsSync(file)) listings = JSON.parse(readFileSync(file, 'utf8')); }
      catch { await new Promise(resolve => setTimeout(resolve, 200)); continue; }
      if (source.id in listings) {
        if (listings[source.id].data) return { data: listings[source.id].data };
        throw new Error(listings[source.id].error || 'Firecrawl listing failed');
      }
      await new Promise(resolve => setTimeout(resolve, 4000));
    }
    throw new Error('Timed out waiting for Firecrawl batch listing');
  };
  const strategies = [
    ['publisher feed', async () => collectFeed(source)],
    ['primary Firecrawl listing', async () => process.env.COLLECTION_BATCH_LISTINGS === '1' ? cachedListing() : scrapeHeadlines(source, DEFAULT_INCLUDE, key)],
    ['alternate feed', async () => collectFallbackFeed(source, fetch, () => true)],
    ['alternate Firecrawl listing', async () => { const url = fallbackListingUrl(source); return url ? process.env.COLLECTION_BATCH_ALTERNATE === '1' ? cachedListing(`alternate-listings-${runId}.json`) : scrapeHeadlines({ ...source, listingUrl: url }, DEFAULT_INCLUDE, key) : null; }],
    ['Firecrawl site search', async () => searchSourceArticles(source, DEFAULT_INCLUDE, key)]
  ];
  const retryPrimary = record.errors.some(error => error.startsWith('primary Firecrawl listing:'))
    ? [['primary Firecrawl listing retry', async () => scrapeHeadlines(source, DEFAULT_INCLUDE, key)]] : [];
  const activeStrategies = (phase === 'primary' ? strategies.slice(0, 2) : phase === 'fallback' ? [...retryPrimary, ...strategies.slice(2)] : phase === 'supplement' ? strategies.slice(1, 2) : strategies)
    .filter(([method]) => !(process.env.COLLECTION_SKIP_DIRECT_FEEDS === '1' && method === 'alternate feed'));
  for (const [method, collect] of activeStrategies) {
    if (method === 'primary Firecrawl listing' && record.articles.length && phase !== 'primary' && phase !== 'supplement') break;
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
  record.status = phase === 'primary' && !record.articles.length ? 'primaryComplete' : 'complete';
  record.completedAt = new Date().toISOString();
  save();
  console.log(`DONE ${source.id} ${source.name}: ${record.articles.length} relevant, ${record.checkedUrls.length} pages checked`);
}

const selected = process.env.COLLECTION_SOURCE_IDS ? new Set(process.env.COLLECTION_SOURCE_IDS.split(',').map(value => value.trim())) : null;
const ordered = (process.env.COLLECTION_BATCH_LISTINGS === '1' ? sources : [sources.find(source => source.id === 'source-32'), ...sources.filter(source => source.id !== 'source-32' && FEED_URLS[source.id]), ...sources.filter(source => source.id !== 'source-32' && !FEED_URLS[source.id])]).filter(source => source && (!selected || selected.has(source.id)));
for (const source of ordered) await scan(source);
console.log(`COMPLETE ${Object.keys(state.sources).length}/${sources.length} sources, ${Object.values(state.sources).reduce((sum, record) => sum + record.articles.length, 0)} relevant articles`);
