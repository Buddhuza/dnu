export const DEFAULT_INCLUDE = ['security', 'politics', 'defense', 'diplomacy', 'election', 'conflict'];
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

export function googleNewsUrl(words) {
  const query = words.length ? words.map(w => `"${w.replaceAll('"', '')}"`).join(' OR ') : 'world news';
  const url = new URL('https://news.google.com/search');
  url.searchParams.set('q', `(${query}) when:1d`);
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

export function normalizeArticles(payload, source, now = Date.now(), include = DEFAULT_INCLUDE, exclude = DEFAULT_EXCLUDE) {
  const cutoff = now - 24 * 60 * 60 * 1000;
  const seen = new Set();
  const result = [];
  for (const raw of articleArray(payload)) {
    if (!raw || typeof raw !== 'object') continue;
    const title = String(raw.title ?? raw.headline ?? '').trim();
    const summary = String(raw.summary ?? raw.description ?? '').trim();
    const publishedAt = String(raw.publishedAt ?? raw.published_at ?? raw.date ?? '').trim();
    // A date without a time and timezone cannot prove membership in a rolling 24-hour window.
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(publishedAt)) continue;
    const timestamp = Date.parse(publishedAt);
    if (!title || !Number.isFinite(timestamp) || timestamp < cutoff || timestamp > now + 5 * 60 * 1000) continue;
    let url;
    try {
      url = new URL(String(raw.url ?? raw.link ?? ''), source.url);
      if (!['http:', 'https:'].includes(url.protocol)) continue;
    } catch { continue; }
    const key = url.toString();
    if (seen.has(key)) continue;
    const haystack = `${title} ${summary}`.toLocaleLowerCase();
    if (include.length && !include.some(w => haystack.includes(w.toLocaleLowerCase()))) continue;
    if (exclude.some(w => haystack.includes(w.toLocaleLowerCase()))) continue;
    seen.add(key);
    result.push({ id: key, title, summary, url: key, publishedAt: new Date(timestamp).toISOString(), sourceId: source.id, sourceName: source.name, group: source.group });
  }
  return result.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 40);
}

export async function scrapeHeadlines(source, include, apiKey, fetchImpl = fetch) {
  const targetUrl = source.id === 'google-news' ? googleNewsUrl(include) : source.url;
  const prompt = 'Extract news article headlines linked from this page. Return an object with an articles array. For each article return title, absolute article URL, a brief summary if visible, and publishedAt as an ISO 8601 timestamp with timezone. Only include articles with a clearly visible publication date and time. Do not invent dates, titles, or URLs. Do not include navigation links.';
  return firecrawlPost({ url: targetUrl, formats: [{ type: 'json', prompt }], onlyMainContent: true, timeout: 30000 }, apiKey, fetchImpl);
}

export async function scrapeArticle(url, apiKey, fetchImpl = fetch) {
  const prompt = 'Read the original news article. Return an object with exactHeadline copied verbatim from the article, publishedAt as an ISO 8601 timestamp with timezone only if explicitly available, and summary as exactly one factual sentence containing the most important new detail from the first few article paragraphs. The summary must add information not already in the headline. Do not include opinion, interpretation, or invented details.';
  return firecrawlPost({ url, formats: ['markdown', { type: 'json', prompt }], onlyMainContent: true, timeout: 30000 }, apiKey, fetchImpl);
}
