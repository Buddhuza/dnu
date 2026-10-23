import { extractBrowserArticleBody } from './articleBodyText.js';
import { getStoredArticleBody, storeArticleBody } from './articleBodyStore.js';

let onlineSnapshotPromise;
async function cachedOnlineBody(url, fetchImpl) {
  if (!onlineSnapshotPromise) {
    const base = import.meta.env?.BASE_URL || '/';
    onlineSnapshotPromise = fetchImpl(`${base}article-bodies.json`, { cache: 'no-cache' })
      .then(response => response.ok ? response.json() : null)
      .catch(() => null);
  }
  const snapshot = await onlineSnapshotPromise;
  return snapshot?.articles?.[url]?.body ? snapshot.articles[url] : null;
}

export async function loadFullArticle(article, { serverAvailable = false, fetchImpl = fetch } = {}) {
  const cached = await getStoredArticleBody(article.url);
  if (cached?.body) return cached;
  if (serverAvailable) {
    try {
      const response = await fetchImpl('/api/article-body', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: article.url }) });
      const result = await response.json();
      if (response.ok && result.body) { await storeArticleBody(article.url, result); return result; }
      if (response.ok || response.status !== 503) throw new Error(result.error || `Article page unavailable (HTTP ${response.status}).`);
    } catch (error) {
      if (!/Failed to fetch|NetworkError|HTTP 503/i.test(error.message)) throw error;
    }
  }
  const online = await cachedOnlineBody(article.url, fetchImpl);
  if (online) { await storeArticleBody(article.url, online); return online; }
  const apiKey = localStorage.getItem('dnu-firecrawl-api-key-v1') || sessionStorage.getItem('dnu-firecrawl-api-key-session-v1');
  if (!apiKey) throw new Error('Firecrawl key needed on this browser. Save it in Add articles, then retry.');
  const response = await fetchImpl('https://api.firecrawl.dev/v2/scrape', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: article.url, formats: ['markdown', 'html', { type: 'json', prompt: 'Extract the exact article headline. Do not summarise.' }], onlyMainContent: true, timeout: 30000 }),
    signal: AbortSignal.timeout(45000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) throw new Error(result.error || `Firecrawl returned HTTP ${response.status}.`);
  const page = result.data || result;
  const body = extractBrowserArticleBody(page, article.title);
  if (body.split(/\s+/).length < 25) throw new Error('The article page did not provide a full readable body.');
  const headings = page.html && typeof DOMParser !== 'undefined' ? [...new DOMParser().parseFromString(page.html, 'text/html').querySelectorAll('h1')].map(node => node.textContent.replace(/\s+/g, ' ').trim()) : [];
  const expected = String(article.title).toLowerCase().match(/[a-z]{5,}/g) || [];
  const heading = headings.find(value => value.length > 15 && expected.filter(word => value.toLowerCase().includes(word)).length >= Math.min(2, expected.length))
    || page.metadata?.title || page.json?.exactHeadline || article.title;
  const full = { heading: String(heading).trim(), body };
  await storeArticleBody(article.url, full);
  return full;
}
