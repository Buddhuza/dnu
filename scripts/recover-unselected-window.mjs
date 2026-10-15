import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reviewedArticleCheck } from '../server/news.js';
import { isEnglishListingText, editorialScore } from '../server/editorialPolicy.js';
import { articlePlacement } from '../server/importArticle.js';
import { IMPORT_PROMPT } from '../src/importPrompt.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const sources = JSON.parse(readFileSync(join(root, 'sources.json'), 'utf8'));
const earlier = JSON.parse(readFileSync(join(root, 'data/daily-update-2026-10-14-15.json'), 'utf8'));
const primary = JSON.parse(readFileSync(join(root, 'data/collection-2026-10-14-working.json'), 'utf8'));
const path = join(root, 'data/collection-2026-10-14-recovery.json');
const state = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { windowStart: earlier.windowStart, windowEnd: earlier.windowEnd, sources: {} };
const key = process.env.FIRECRAWL_API_KEY;
if (!key) throw new Error('FIRECRAWL_API_KEY is not set');
const start = Date.parse(earlier.windowStart), end = Date.parse(earlier.windowEnd);
const selected = process.env.RECOVERY_SOURCE_IDS ? new Set(process.env.RECOVERY_SOURCE_IDS.split(',').map(x => x.trim())) : null;
const deep = process.env.RECOVERY_DEEP === '1';
const targets = earlier.sourceOutcomes.filter(outcome => selected ? selected.has(outcome.id) : outcome.status !== 'collected');
const save = () => writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`);
const topical = value => /\b(?:OSCE|politic\w*|secur\w*|war|conflict\w*|terror\w*|militar\w*|defen[csd]\w*|radar\w*|army|forces|border\w*|sanction\w*|diploma\w*|cooperat\w*|foreign|minister\w*|president\w*|government\w*|parliament\w*|election\w*|summit\w*|talks|treaty|peace|NATO|European Union|EU|United Nations|UN|Russia\w*|Ukraine|Iran\w*|Israel\w*|Gaza|missile\w*|drone\w*|weapons|protest\w*|ambassador\w*|attack\w*)\b/i.test(value);

async function api(endpoint, body, method = 'POST') {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`https://api.firecrawl.dev/v2/${endpoint}`, {
      method, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(60000)
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.success !== false) return data;
    if (response.status !== 429 || attempt === 2) throw new Error(data.error || data.message || `HTTP ${response.status}`);
    await new Promise(resolve => setTimeout(resolve, 15000));
  }
}

async function batchPages(urls) {
  const batch = await api('batch/scrape', { urls, formats: ['markdown', 'rawHtml', { type: 'json', prompt: IMPORT_PROMPT }], onlyMainContent: false, timeout: 30000 });
  const pages = new Map();
  for (let attempt = 0; attempt < 45; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    const status = await api(`batch/scrape/${batch.id}`, null, 'GET');
    for (const page of status.data || []) {
      const url = page.metadata?.sourceURL || page.metadata?.url;
      if (url) pages.set(url, page);
    }
    if (status.status === 'completed' || status.completed >= status.total) return urls.map(url => pages.get(url) || null);
    if (status.status === 'failed') throw new Error(status.error || 'Batch failed');
  }
  throw new Error(`Batch ${batch.id} timed out`);
}

function articleLink(raw, source) {
  let url;
  try { url = new URL(raw.url, source.url); } catch { return null; }
  const host = value => value.hostname.toLowerCase().replace(/^www\./, '');
  const sourceHost = host(new URL(source.url));
  if (url.protocol !== 'https:' || host(url) !== sourceHost || /\.(?:pdf|jpg|png|xml|mp4)$/.test(url.pathname)) return null;
  if (/\/(?:category|tag|page|archive|search)(?:\/|$)/i.test(url.pathname)) return null;
  if (/\/(?:201\d|202[0-5])\//.test(url.pathname) || /\/2026\/(?:0?[1-9]|10)\/(?:0?[1-9]|1[0-3])\//.test(url.pathname)) return null;
  const title = String(raw.title || '').trim();
  const listedTime = Date.parse(raw.publishedAt || '');
  if (!title || !isEnglishListingText(title) || (!topical(`${title} ${raw.description || ''}`) && !(listedTime >= start && listedTime < end))) return null;
  return { url: url.href, title, listedAt: raw.publishedAt || '', score: editorialScore(title, raw.description || '') };
}

function publisherDateOnPage(page) {
  const values = [page.metadata?.publishedDate, page.metadata?.datePublished, page.metadata?.date, page.json?.publishedAt];
  const html = String(page.rawHtml || '').slice(0, 150000);
  const markup = String(page.markdown || '').slice(0, 3500);
  for (const value of values) {
    const match = String(value || '').match(/\b(2026-10-(?:14|15))\b/);
    if (match) return match[1];
  }
  const numeric = html.match(/\b2026-10-(?:14|15)\b/) || markup.match(/\b2026-10-(?:14|15)\b/);
  if (numeric) return numeric[0];
  const natural = `${html.slice(0, 30000)} ${markup}`.match(/\b(?:14|15)\s+Oct(?:ober)?\s+2026\b|\bOct(?:ober)?\s+(?:14|15),?\s+2026\b/i);
  if (natural) return /15/.test(natural[0]) ? '2026-10-15' : '2026-10-14';
  return '';
}

async function recover(outcome) {
  const source = sources.find(item => item.id === outcome.id);
  const record = state.sources[source.id] ??= { id: source.id, name: source.name, status: 'running', articles: [], checkedUrls: [], dateOnly: [], attempts: [], errors: [] };
  if (record.status === 'complete' && !deep) return;
  console.log(`RECOVER ${source.id} ${source.name}`);
  const existing = primary.sources[source.id] || { attempts: [], articles: [] };
  const candidates = new Map();
  const offer = raw => { const item = articleLink(raw, source); if (item && !candidates.has(item.url)) candidates.set(item.url, item); };
  for (const article of existing.articles || []) offer(article);
  for (const attempt of existing.attempts || []) for (const item of attempt.listedArticles || []) offer(item);
  if (source.id === 'source-32') {
    offer({ url: 'https://ipn.md/en/ukraine-will-increase-by-20-the-water-flow-discharged-from-novodnestrovsk-prime-minister-tofan/', title: 'Ukraine will increase water discharge to Moldova' });
    offer({ url: 'https://ipn.md/en/moldova-could-reach-500-million-euros-through-the-growth-plan-by-the-end-of-the-year/', title: 'Moldova could reach 500 million euros through EU Growth Plan' });
  }
  const domain = new URL(source.url).hostname.replace(/^www\./, '');
  const queries = deep
    ? [`site:${domain} "2026-10-14" security politics cooperation`, `site:${domain} "15 October 2026" security politics cooperation`]
    : [`site:${domain} "14 October 2026" security politics Ukraine OSCE`, `site:${domain} "October 14, 2026" security politics war diplomacy`];
  for (const query of queries) {
    try {
      const result = await api('search', { query, limit: 10 });
      const found = result.data?.web || [];
      record.attempts.push({ method: 'Firecrawl dated site search', query, listed: found.length });
      for (const item of found) offer(item);
    } catch (error) { record.errors.push(`Search: ${error.message}`); }
  }
  const checked = new Set(record.checkedUrls);
  const rawUrls = new Set((existing.articles || []).map(article => article.url));
  const queue = [...candidates.values()].sort((a, b) => Number(rawUrls.has(b.url)) - Number(rawUrls.has(a.url)) || Number(Date.parse(b.listedAt) >= start && Date.parse(b.listedAt) < end) - Number(Date.parse(a.listedAt) >= start && Date.parse(a.listedAt) < end) || b.score - a.score).filter(item => !checked.has(item.url)).slice(0, deep ? 30 : 16);
  console.log(`${source.id} ${source.name}: ${queue.length} candidate pages`);
  for (let offset = 0; offset < queue.length; offset += 8) {
    const group = queue.slice(offset, offset + 8);
    let pages;
    try { pages = await batchPages(group.map(item => item.url)); }
    catch (error) { record.errors.push(`Article batch: ${error.message}`); save(); continue; }
    for (let index = 0; index < group.length; index++) {
      const candidate = group[index], page = pages[index];
      record.checkedUrls.push(candidate.url);
      if (!page) { record.errors.push(`No page returned: ${candidate.url}`); continue; }
      try {
        const check = reviewedArticleCheck({ data: page }, source, candidate.url, end);
        if (!check.article) {
          const pageDate = publisherDateOnPage(page);
          if (pageDate && check.reason === 'missingHeadlineOrTime') record.dateOnly.push({ url: candidate.url, title: candidate.title, pageDate });
          continue;
        }
        const time = Date.parse(check.article.publishedAt);
        if (/^2026-10-14T00:00:00(?:\.000)?Z$/.test(check.article.publishedAt)) {
          const pageDate = publisherDateOnPage(page);
          if (pageDate) record.dateOnly.push({ url: candidate.url, title: candidate.title, pageDate });
          continue;
        }
        if (time < start || time >= end) continue;
        const extracted = typeof page.json === 'string' ? JSON.parse(page.json) : page.json || {};
        const placement = articlePlacement(extracted, check.article.title, check.article.summary);
        record.articles.push({ ...check.article, section: placement?.sectionId || '', subsection: placement?.subsection || '', country: placement?.country || '', reviewed: true });
      } catch (error) { record.errors.push(`${candidate.url}: ${error.message}`); }
    }
    save();
    console.log(`${source.id} ${source.name}: ${Math.min(offset + group.length, queue.length)}/${queue.length} checked, ${record.articles.length} verified, ${record.dateOnly.length} date-only`);
  }
  record.articles = [...new Map(record.articles.map(article => [article.url, article])).values()];
  record.status = 'complete';
  save();
  console.log(`RECOVERED ${source.id} ${source.name}: ${record.articles.length} verified, ${record.dateOnly.length} date-only`);
}

let cursor = 0;
const workers = Array.from({ length: 4 }, async () => {
  while (cursor < targets.length) {
    const outcome = targets[cursor++];
    try { await recover(outcome); }
    catch (error) { const record = state.sources[outcome.id]; if (record) { record.errors.push(error.message); record.status = 'complete'; save(); } console.error(`${outcome.id}: ${error.message}`); }
  }
});
await Promise.all(workers);
console.log(`RECOVERY COMPLETE: ${Object.values(state.sources).filter(source => source.status === 'complete').length}/${targets.length}`);
