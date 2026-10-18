import { editorialScore, isEnglishArticle, passesSourcePolicy } from './editorialPolicy.js';
import { IMPORT_PROMPT } from '../src/importPrompt.js';
import { publicationTimestamp } from './importArticle.js';
import { wallTimeToIso } from '../src/viennaTime.js';

export const DEFAULT_INCLUDE = ['OSCE', 'cooperation', 'diplomacy', 'bilateral', 'foreign policy', 'talks', 'summit', 'peace', 'sanctions', 'NATO', 'EU', 'UN', 'security', 'defense', 'defence', 'conflict', 'war', 'terrorism', 'military', 'politics', 'political', 'election', 'Russia', 'Ukraine'];
export const DEFAULT_EXCLUDE = [];

let nextFirecrawlSlot = 0;
let queue = Promise.resolve();
async function firecrawlPost(payload, apiKey, fetchImpl = fetch, endpoint = 'scrape') {
  const task = queue.then(async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const delay = Math.max(0, nextFirecrawlSlot - Date.now());
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      // Keep the shared standard-plan limit below ten requests per minute.
      nextFirecrawlSlot = Date.now() + 6500;
      const response = await fetchImpl(`https://api.firecrawl.dev/v2/${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(45000)
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok && body.success !== false) return body;
      if (response.status === 429 && attempt === 0) {
        const seconds = Number(String(body.error ?? '').match(/retry after (\d+)s/i)?.[1] ?? 60);
        nextFirecrawlSlot = Date.now() + Math.min(65000, (seconds + 1) * 1000);
        continue;
      }
      throw new Error(body.error || body.message || `Firecrawl returned HTTP ${response.status}`);
    }
  });
  queue = task.catch(() => {});
  return task;
}

export function parseWords(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(v => String(v).trim()).filter(Boolean))].slice(0, 40).map(v => v.slice(0, 60));
}

export function customSourceFromRequest(value) {
  if (!value || typeof value !== 'object' || !/^manual-source-[a-zA-Z0-9-]{1,100}$/.test(value.id ?? '')) return null;
  const name = String(value.name ?? '').trim().slice(0, 80);
  const group = String(value.group ?? 'Custom').trim().slice(0, 80) || 'Custom';
  if (!name) return null;
  try {
    const url = new URL(String(value.url ?? ''));
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
    const host = url.hostname.toLowerCase();
    if (!host.includes('.') || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || /^[0-9.]+$/.test(host) || host.includes(':')) return null;
    return { id: value.id, name, group, url: url.href };
  } catch { return null; }
}

export function articleArray(payload) {
  const json = payload?.data?.json ?? payload?.json;
  const value = typeof json === 'string' ? JSON.parse(json) : json;
  if (Array.isArray(value)) return value;
  return value?.articles ?? value?.headlines ?? [];
}

export function fallbackListingUrl(source) {
  if (source.listingUrl && source.listingUrl !== source.url) return source.url;
  const url = new URL(source.url);
  const home = `${url.origin}/`;
  return url.href === home ? null : home;
}

function permittedArticleUrl(url, source) {
  if (!source.articlePathPrefix) return true;
  return url.hostname.replace(/^www\./, '') === new URL(source.url).hostname.replace(/^www\./, '')
    && url.pathname.startsWith(source.articlePathPrefix);
}

export function normalizeArticles(payload, source, now = Date.now(), include = DEFAULT_INCLUDE, exclude = DEFAULT_EXCLUDE, allowMidnight = false) {
  const cutoff = now - 48 * 60 * 60 * 1000;
  const seen = new Set();
  const result = [];
  for (const raw of articleArray(payload)) {
    if (!raw || typeof raw !== 'object') continue;
    const title = String(raw.title ?? raw.headline ?? '').trim();
    const summary = String(raw.summary ?? raw.description ?? '').trim();
    const publishedAt = String(raw.publishedAt ?? raw.published_at ?? raw.date ?? '').trim();
    // A date without a time and timezone cannot prove membership in a rolling 48-hour window.
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(publishedAt)) continue;
    if (!allowMidnight && /T00:00:00(?:\.0+)?Z$/i.test(publishedAt)) continue;
    const timestamp = Date.parse(publishedAt);
    if (!title || !Number.isFinite(timestamp) || timestamp < cutoff || timestamp > now + 5 * 60 * 1000) continue;
    let url;
    try {
      url = new URL(String(raw.url ?? raw.absoluteUrl ?? raw.link ?? ''), source.url);
      if (!['http:', 'https:'].includes(url.protocol) || !permittedArticleUrl(url, source)) continue;
    } catch { continue; }
    const key = url.toString();
    if (seen.has(key)) continue;
    const haystack = `${title} ${summary}`.toLocaleLowerCase();
    if (include.length && !include.some(w => haystack.includes(w.toLocaleLowerCase()))) continue;
    if (exclude.some(w => haystack.includes(w.toLocaleLowerCase()))) continue;
    if (!passesSourcePolicy(source, title, summary)) continue;
    seen.add(key);
    result.push({ id: key, title, summary, url: key, publishedAt: new Date(timestamp).toISOString(), sourceId: source.id, sourceName: source.agencyName || source.name, group: source.group });
  }
  return result.sort((a, b) => editorialScore(b.title, b.summary) - editorialScore(a.title, a.summary) || b.publishedAt.localeCompare(a.publishedAt)).slice(0, 40);
}

export function undatedCandidates(payload, source, include = DEFAULT_INCLUDE, exclude = DEFAULT_EXCLUDE, verifyAll = false) {
  const seen = new Set();
  const candidates = [];
  for (const raw of articleArray(payload)) {
    if (!raw || typeof raw !== 'object') continue;
    const listedTime = String(raw.publishedAt ?? raw.published_at ?? raw.date ?? '');
    if (!verifyAll && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(listedTime) && !/T00:00:00(?:\.0+)?Z$/i.test(listedTime)) continue;
    const title = String(raw.title ?? raw.headline ?? '').trim();
    const summary = String(raw.summary ?? raw.description ?? '').trim();
    if (!title) continue;
    const haystack = `${title} ${summary}`.toLocaleLowerCase();
    if (include.length && !include.some(w => haystack.includes(w.toLocaleLowerCase()))) continue;
    if (exclude.some(w => haystack.includes(w.toLocaleLowerCase()))) continue;
    if (!passesSourcePolicy(source, title, summary)) continue;
    let url;
    try {
      url = new URL(String(raw.url ?? raw.absoluteUrl ?? raw.link ?? ''), source.url);
      if (url.protocol !== 'https:' || url.hostname.replace(/^www\./, '') !== new URL(source.url).hostname.replace(/^www\./, '') || !permittedArticleUrl(url, source)) continue;
    } catch { continue; }
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    const listingPriority = raw.priority == null ? NaN : Number(raw.priority);
    candidates.push({ title, summary, url: url.href, listingPriority: Number.isFinite(listingPriority) && listingPriority >= 0 && listingPriority <= 5 ? listingPriority : null });
  }
  return candidates.sort((a, b) => (b.listingPriority ?? -1) - (a.listingPriority ?? -1) || editorialScore(b.title, b.summary) - editorialScore(a.title, a.summary));
}

export function candidatePage(candidates, cursor = 0, fullScan = false, deepScan = false, selective = false) {
  const offset = fullScan ? Math.min(candidates.length, Math.max(0, Math.trunc(Number(cursor) || 0))) : 0;
  const limit = selective ? 3 : fullScan || deepScan ? 10 : 3;
  const items = candidates.slice(offset, offset + limit);
  return { items, nextCursor: fullScan && offset + items.length < candidates.length ? offset + items.length : null };
}

// Bulk monitoring checks each outlet, but opens only the strongest listing links.
// The explicit complete scan continues to use the full candidate list.
export function shortlistCandidates(candidates, limit = 12) {
  return candidates.filter(candidate => candidate.listingPriority == null || candidate.listingPriority >= 3).slice(0, limit);
}

export function reviewedArticleCheck(payload, source, url, now = Date.now(), maxAgeMs = 48 * 60 * 60 * 1000) {
  const data = payload?.data ?? {};
  const extracted = typeof data.json === 'string' ? JSON.parse(data.json) : data.json ?? {};
  const html = data.rawHtml || data.html || '';
  const head = html.includes('</head>') ? html.slice(0, html.indexOf('</head>')) : html.slice(0, 100000);
  const publisherZone = { 'aa.com.tr': 'Europe/Istanbul', 'mina.news': 'Europe/Podgorica', 'aljazeera.com': 'Asia/Qatar' }[new URL(url).hostname.replace(/^www\./, '')];
  const localPublisherTime = publisherZone && String(data.metadata?.publishedTime || data.metadata?.publishedDate || '').match(/^(20\d{2})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/);
  const inferredPublisherTime = localPublisherTime ? wallTimeToIso(publisherZone, ...localPublisherTime.slice(1, 7).map((value, index) => Number(value || (index === 5 ? 0 : value)))) : null;
  const tassTime = new URL(url).hostname === 'tass.com' ? html.match(/<dateformat\s+time="(\d{10})"\s+mode="abs"/)?.[1] : null;
  const izvestiaTime = new URL(url).hostname === 'iz.ru' ? html.match(/itemprop="datePublished">([^<]+)/)?.[1] : null;
  const publishedAt = publicationTimestamp(
    data.metadata?.publishedTime, data.metadata?.['article:published_time'], data.metadata?.['og:article:published_time'], data.metadata?.mediator_published_time,
    data.metadata?.['cXenseParse:publishtime'], data.metadata?.publishedDate, data.metadata?.datePublished, data.metadata?.['date.available'],
    ...[...head.matchAll(/["']datePublished["']\s*:\s*["']([^"']+)/gi)].map(match => match[1]),
    inferredPublisherTime, izvestiaTime, tassTime ? new Date(Number(tassTime) * 1000).toISOString() : null, extracted.publishedAt
  );
  if (!publishedAt) return { article: null, reason: 'missingHeadlineOrTime' };
  const time = Date.parse(publishedAt);
  if (!Number.isFinite(time)) return { article: null, reason: 'missingHeadlineOrTime' };
  if (time < now - maxAgeMs || time > now + 300000) return { article: null, reason: 'outsideWindow' };
  const title = String(data.metadata?.ogTitle ?? extracted.exactHeadline ?? data.metadata?.title ?? '').trim();
  if (!title) return { article: null, reason: 'missingHeadlineOrTime' };
  const summary = String(extracted.summary ?? '').trim();
  if (!isEnglishArticle(payload, title, summary)) return { article: null, reason: 'nonEnglish' };
  if (!passesSourcePolicy(source, title, summary)) return { article: null, reason: 'outsideScope' };
  return { article: { id: url, url, sourceId: source.id, sourceName: source.agencyName || source.name, group: source.group, title, summary, publishedAt: new Date(time).toISOString() }, reason: null };
}

export function reviewedArticle(payload, source, url, now = Date.now()) {
  return reviewedArticleCheck(payload, source, url, now).article;
}

export async function scrapeHeadlines(source, include, apiKey, fetchImpl = fetch) {
  const targetUrl = source.listingUrl || source.url;
  const prompt = 'Extract English-language news article headlines linked from this page. Return an object with an articles array. For each article return title, url (absolute article URL), description only if visible on this listing page, and publishedAt as an ISO 8601 timestamp with timezone only when the exact time and timezone are visible. Also assign priority from 0 to 5 using only the visible headline and description: 5 for important OSCE, war, cross-border security or diplomacy, 4 for other external cooperation or international politics, 3 for relevant national security or politics, 0 to 2 for weakly relevant items. Include plausible article links even when the time is not visible; omit publishedAt for those. Do not turn a date-only label into a midnight timestamp. Do not invent dates, titles, descriptions, or URLs. Do not include navigation links.';
  return firecrawlPost({ url: targetUrl, formats: [{ type: 'json', prompt }], onlyMainContent: true, timeout: 30000 }, apiKey, fetchImpl);
}

export async function scrapeArticle(url, apiKey, fetchImpl = fetch) {
  const prompt = 'Read the original English-language news article. Return an object with exactHeadline copied verbatim, publishedAt as an ISO 8601 timestamp with timezone only if explicitly available, and summary as exactly one factual sentence of 10 to 25 words. Use the most important concrete detail from the first two substantive paragraphs that is absent from the headline. Omit repeated headline facts, scene-setting, commentary and background. If no additional concrete detail is available there, leave summary empty. Do not translate a non-English article. Do not invent dates or facts, and do not add opinion or analysis.';
  return firecrawlPost({ url, formats: ['markdown', 'html', { type: 'json', prompt }], onlyMainContent: true, timeout: 30000 }, apiKey, fetchImpl);
}

export async function scrapeImportedArticle(url, apiKey, fetchImpl = fetch) {
  return firecrawlPost({ url, formats: ['markdown', 'html', { type: 'json', prompt: IMPORT_PROMPT }], onlyMainContent: true, timeout: 30000 }, apiKey, fetchImpl);
}

export async function searchSourceArticles(source, include, apiKey, fetchImpl = fetch, lookbackDays = 2) {
  const host = new URL(source.url).hostname.replace(/^www\./, '');
  const terms = include.length ? include.slice(0, 8) : ['politics', 'security', 'war', 'election'];
  const query = `site:${host} (${terms.map(term => `"${term.replace(/[^\p{L}\p{N}\s-]/gu, '')}"`).join(' OR ')})`;
  const payload = await firecrawlPost({ query, limit: 10, tbs: `qdr:d${Math.max(1, Math.ceil(lookbackDays))}` }, apiKey, fetchImpl, 'search');
  const results = payload.data?.web ?? [];
  return { data: { json: { articles: results.map(item => ({ title: item.title, url: item.url, summary: item.description })) } }, collectionMethod: 'firecrawl-search', searchQuery: query };
}
