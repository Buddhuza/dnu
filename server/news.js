export const DEFAULT_INCLUDE = ['security', 'politics', 'political', 'defense', 'diplomacy', 'election', 'conflict', 'war', 'terrorism', 'parliament', 'government', 'minister', 'president', 'police', 'military', 'NATO', 'Russia', 'Ukraine', 'attack', 'sanctions', 'protest'];
export const DEFAULT_EXCLUDE = [];

let nextFirecrawlSlot = 0;
let queue = Promise.resolve();
async function firecrawlPost(payload, apiKey, fetchImpl = fetch) {
  const task = queue.then(async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const delay = Math.max(0, nextFirecrawlSlot - Date.now());
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      // Keep the shared standard-plan limit below ten requests per minute.
      nextFirecrawlSlot = Date.now() + 6500;
      const response = await fetchImpl('https://api.firecrawl.dev/v2/scrape', {
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
  return [...new Set(value.map(v => String(v).trim()).filter(Boolean))].slice(0, 25).map(v => v.slice(0, 60));
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

export function googleNewsUrl(words) {
  const query = words.length ? words.map(w => `"${w.replaceAll('"', '')}"`).join(' OR ') : 'world news';
  const url = new URL('https://news.google.com/search');
  url.searchParams.set('q', `(${query}) when:2d`);
  url.searchParams.set('hl', 'en-US');
  url.searchParams.set('gl', 'US');
  url.searchParams.set('ceid', 'US:en');
  return url.toString();
}

function articleArray(payload) {
  const json = payload?.data?.json ?? payload?.json;
  const value = typeof json === 'string' ? JSON.parse(json) : json;
  if (Array.isArray(value)) return value;
  return value?.articles ?? value?.headlines ?? [];
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
    seen.add(key);
    result.push({ id: key, title, summary, url: key, publishedAt: new Date(timestamp).toISOString(), sourceId: source.id, sourceName: source.agencyName || source.name, group: source.group });
  }
  return result.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 40);
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
    let url;
    try {
      url = new URL(String(raw.url ?? raw.absoluteUrl ?? raw.link ?? ''), source.url);
      if (url.protocol !== 'https:' || url.hostname.replace(/^www\./, '') !== new URL(source.url).hostname.replace(/^www\./, '') || !permittedArticleUrl(url, source)) continue;
    } catch { continue; }
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    candidates.push({ title, url: url.href });
  }
  return candidates;
}

export function reviewedArticle(payload, source, url, now = Date.now()) {
  const data = payload?.data ?? {};
  const extracted = typeof data.json === 'string' ? JSON.parse(data.json) : data.json ?? {};
  const publishedAt = data.metadata?.publishedTime ?? data.metadata?.['article:published_time'] ?? extracted.publishedAt;
  if (!publishedAt || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(publishedAt)) return null;
  const time = Date.parse(publishedAt);
  if (!Number.isFinite(time) || time < now - 48 * 60 * 60 * 1000 || time > now + 300000) return null;
  const title = String(data.metadata?.ogTitle ?? extracted.exactHeadline ?? data.metadata?.title ?? '').trim();
  if (!title) return null;
  return { id: url, url, sourceId: source.id, sourceName: source.agencyName || source.name, group: source.group, title, summary: String(extracted.summary ?? '').trim(), publishedAt: new Date(time).toISOString() };
}

export async function scrapeHeadlines(source, include, apiKey, fetchImpl = fetch) {
  const targetUrl = source.id === 'google-news' ? googleNewsUrl(include) : source.listingUrl || source.url;
  const prompt = 'Extract news article headlines linked from this page. Return an object with an articles array. For each article return title, url (absolute article URL), a brief summary if visible, and publishedAt as an ISO 8601 timestamp with timezone only when the exact time and timezone are visible. Include article links even when the date or time is not visible; omit publishedAt for those. Do not turn a date-only label into a midnight timestamp. Do not invent dates, titles, or URLs. Do not include navigation links.';
  return firecrawlPost({ url: targetUrl, formats: [{ type: 'json', prompt }], onlyMainContent: true, timeout: 30000 }, apiKey, fetchImpl);
}

export async function scrapeArticle(url, apiKey, fetchImpl = fetch) {
  const prompt = 'Read the original news article. Return an object with exactHeadline copied verbatim from the article, publishedAt as an ISO 8601 timestamp with timezone only if explicitly available, and summary as exactly one factual sentence containing the most important new detail from the first few article paragraphs. The summary must add information not already in the headline. Do not include opinion, interpretation, or invented details.';
  return firecrawlPost({ url, formats: ['markdown', { type: 'json', prompt }], onlyMainContent: true, timeout: 30000 }, apiKey, fetchImpl);
}
