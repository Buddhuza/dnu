import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reviewedArticleCheck } from '../server/news.js';
import { articlePlacement } from '../server/importArticle.js';
import { isEnglishListingText, passesSourcePolicy } from '../server/editorialPolicy.js';
import { IMPORT_PROMPT } from '../src/importPrompt.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const sources = JSON.parse(readFileSync(join(root, 'sources.json'), 'utf8'));
const primary = JSON.parse(readFileSync(join(root, 'data/collection-2026-10-14-working.json'), 'utf8'));
const path = process.env.FALLBACK_CHECKPOINT || join(root, 'data/collection-2026-10-14-fallback.json');
const state = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { windowStart: primary.windowStart, windowEnd: primary.windowEnd, sources: {} };
const key = process.env.FIRECRAWL_API_KEY;
if (!key) throw new Error('FIRECRAWL_API_KEY is not set');
const start = Date.parse(primary.windowStart);
const end = Date.parse(primary.windowEnd);
const save = () => writeFileSync(path, JSON.stringify(state, null, 2));
const inWindow = value => { const time = Date.parse(value); return Number.isFinite(time) && time >= start && time < end; };
const topical = text => /\b(?:OSCE|secur\w*|war|conflict\w*|terror\w*|militar\w*|defen[cs]\w*|border\w*|sanction\w*|diploma\w*|cooperat\w*|foreign|minister\w*|president\w*|government\w*|parliament\w*|election\w*|party|summit\w*|talks|treaty|peace|ceasefire\w*|NATO|European Union|EU|United Nations|UN|Russia\w*|Ukraine|Ukrainian|Iran\w*|Israel\w*|Gaza|Caucasus|Central Asia|missile\w*|drone\w*|arms|weapons|protest\w*|intelligence|ambassador\w*|negotiat\w*|invas\w*|attack\w*|coup|referendum|alliance\w*)\b/i.test(text);

async function post(endpoint, body) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`https://api.firecrawl.dev/v2/${endpoint}`, {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(45000)
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.success !== false) return data;
    if (response.status !== 429 || attempt === 2) throw new Error(data.error || data.message || `HTTP ${response.status}`);
    await new Promise(resolve => setTimeout(resolve, 15000));
  }
}

async function batchPages(urls) {
  const batch = await post('batch/scrape', { urls, formats: ['markdown', 'html', { type: 'json', prompt: IMPORT_PROMPT }], onlyMainContent: true, timeout: 30000 });
  const pages = new Map();
  for (let attempt = 0; attempt < 45; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 4000));
    const response = await fetch(`https://api.firecrawl.dev/v2/batch/scrape/${batch.id}`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(45000) });
    const status = await response.json();
    if (!response.ok) throw new Error(status.error || `Batch status HTTP ${response.status}`);
    for (const page of status.data || []) {
      const url = page.metadata?.sourceURL || page.metadata?.url;
      if (url) pages.set(url, page);
    }
    if (status.status === 'completed' || status.completed >= status.total) return urls.map(url => pages.get(url) || null);
    if (status.status === 'failed') throw new Error(status.error || 'Batch failed');
  }
  throw new Error(`Batch ${batch.id} timed out`);
}

function validCandidate(item, source, known) {
  let url;
  try { url = new URL(item.url, source.url); }
  catch { return null; }
  if (source.id === 'source-32') url.pathname = url.pathname.replace(/\/$/, '');
  if (url.protocol !== 'https:' || url.hostname.replace(/^www\./, '') !== new URL(source.url).hostname.replace(/^www\./, '')) return null;
  if (source.id === 'source-26' && !url.pathname.includes('/view/')) return null;
  if (/\/(?:page|archive)\/\d+\/?$/i.test(url.pathname) || /\/(?:all-news|all_news|latest-news)\/?$/i.test(url.pathname)) return null;
  if (/\.(?:jpg|png|pdf|zip|mp4|xml)$/i.test(url.pathname) || known.has(url.href)) return null;
  const title = String(item.title || '').trim();
  const description = String(item.description || item.summary || '').trim();
  if (!title || !isEnglishListingText(title, description) || !passesSourcePolicy(source, title, description) || !topical(`${title} ${description}`)) return null;
  if (/\/20(?:1\d|2[0-5])\//.test(url.pathname)) return null;
  if (/\/2026\/(?:0?[1-9]|10)\/(?:0?[1-9]|1[0-3])\//.test(url.pathname)) return null;
  return { url: url.href, title, description };
}

async function scan(source) {
  const previous = primary.sources[source.id];
  if (!previous || previous.status !== 'complete' || previous.articles.length) return;
  const record = state.sources[source.id] ??= { id: source.id, name: source.name, status: 'running', articles: [], checkedUrls: [], attempts: [], errors: [] };
  if (record.status === 'complete') return;
  const known = new Set(record.checkedUrls);
  console.log(`FALLBACK ${source.id} ${source.name}`);
  const listed = previous.attempts.flatMap(attempt => attempt.listedArticles || [])
    .filter(item => !item.publishedAt || inWindow(item.publishedAt))
    .map(item => validCandidate(item, source, known)).filter(Boolean);
  const urls = new Map(listed.map(item => [item.url, item]));
  try {
    const mapped = await post('map', { url: source.url, limit: 100 });
    const links = mapped.links || [];
    record.attempts.push({ method: 'Firecrawl map', listed: links.length });
    for (const item of links) {
      const candidate = validCandidate(item, source, known);
      if (candidate) urls.set(candidate.url, candidate);
    }
  } catch (error) {
    record.errors.push(`Firecrawl map: ${error.message}`);
  }
  save();
  const candidates = [...urls.values()];
  console.log(`${source.id} ${source.name}: ${candidates.length} mapped and listed candidate URLs`);
  for (let offset = 0; offset < candidates.length; offset += 10) {
    const group = candidates.slice(offset, offset + 10);
    let pages;
    try { pages = await batchPages(group.map(item => item.url)); }
    catch (error) { record.errors.push(`Article batch: ${error.message}`); save(); if (/credit|quota|payment required/i.test(error.message)) throw error; continue; }
    for (let index = 0; index < group.length; index++) {
      const candidate = group[index];
      const page = pages[index];
      record.checkedUrls.push(candidate.url);
      if (!page) continue;
      const review = reviewedArticleCheck({ data: page }, source, candidate.url, end);
      if (!review.article || !inWindow(review.article.publishedAt) || !topical(`${review.article.title} ${review.article.summary}`)) continue;
      const canonical = page.metadata?.ogUrl || page.metadata?.['og:url'];
      if (canonical) {
        try {
          const parsed = new URL(canonical);
          if (parsed.protocol === 'https:' && parsed.hostname.replace(/^www\./, '') === new URL(source.url).hostname.replace(/^www\./, '')) {
            review.article.url = parsed.href;
            review.article.id = parsed.href;
          }
        } catch { /* Keep the verified candidate URL. */ }
      }
      const extracted = typeof page.json === 'string' ? JSON.parse(page.json) : page.json || {};
      const placement = articlePlacement(extracted, review.article.title, review.article.summary);
      record.articles.push({ ...review.article, section: placement?.sectionId || '', subsection: placement?.subsection || '', country: placement?.country || '', reviewed: true });
    }
    save();
    console.log(`${source.id} ${source.name}: ${Math.min(offset + group.length, candidates.length)}/${candidates.length} pages, ${record.articles.length} relevant`);
  }
  record.articles = [...new Map(record.articles.map(article => [article.url, article])).values()];
  record.status = 'complete';
  save();
  console.log(`FALLBACK DONE ${source.id} ${source.name}: ${record.articles.length} relevant`);
}

const selected = process.env.FALLBACK_SOURCE_IDS ? new Set(process.env.FALLBACK_SOURCE_IDS.split(',').map(value => value.trim())) : null;
for (const source of sources) if (!selected || selected.has(source.id)) await scan(source);
console.log(`FALLBACK COMPLETE ${Object.keys(state.sources).length} sources`);
