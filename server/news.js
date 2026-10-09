export const DEFAULT_INCLUDE = ['security', 'politics', 'defense', 'diplomacy', 'election', 'conflict'];
export const DEFAULT_EXCLUDE = [];

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
  const response = await fetchImpl('https://api.firecrawl.dev/v2/scrape', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: targetUrl, formats: [{ type: 'json', prompt }], onlyMainContent: true, timeout: 30000 }),
    signal: AbortSignal.timeout(45000)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    throw new Error(body.error || body.message || `Firecrawl returned HTTP ${response.status}`);
  }
  return body;
}
