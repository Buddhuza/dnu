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

export async function loadFullArticle(article, { serverAvailable = false, cacheOnly = false, sharedLookup = null, fetchImpl = fetch } = {}) {
  if (String(article.body || '').trim().split(/\s+/).length >= 25)
    return { heading: article.originalHeadline || article.title, body: article.body, translated: article.translated === true };
  if (sharedLookup) {
    const shared = await sharedLookup(article.url);
    if (shared?.body) return shared;
    if (cacheOnly) throw new Error('No full article body is available in the shared update.');
  }
  const cached = await getStoredArticleBody(article.url);
  if (cached?.body && (!article.translated || cached.translated)) return cached;
  if (cacheOnly || article.fromSpreadsheet) throw new Error('No full body was provided in the imported sheet.');
  if (serverAvailable) {
    try {
      const response = await fetchImpl('/api/article-body', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: article.url, translated: article.translated === true }) });
      const result = await response.json();
      if (response.ok && result.body && (!article.translated || result.translated)) { await storeArticleBody(article.url, result); return result; }
      if (response.ok || response.status !== 503) throw new Error(result.error || `Article page unavailable (HTTP ${response.status}).`);
    } catch (error) {
      if (!/Failed to fetch|NetworkError|HTTP 503/i.test(error.message)) throw error;
    }
  }
  const online = await cachedOnlineBody(article.url, fetchImpl);
  if (online && (!article.translated || online.translated)) { await storeArticleBody(article.url, online); return online; }
  throw new Error('No full article text is stored for this story.');
}
