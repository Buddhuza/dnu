import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { canonicalUrl } from './previousCoverage.js';

const failedRetryMs = 6 * 60 * 60 * 1000;

// Append-only records keep verified articles and the Firecrawl page response
// available across collection runs and workspace restarts. A later record for
// the same URL updates only the supplied fields.
export function createArticleCache(path) {
  const entries = new Map();
  if (existsSync(path)) for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      const key = canonicalUrl(record.url);
      if (key) entries.set(key, { ...entries.get(key), ...record });
    } catch { /* Ignore an incomplete final line after an interrupted write. */ }
  }

  function get(url) {
    const record = entries.get(canonicalUrl(url));
    if (!record) return null;
    return {
      ...record,
      page: record.pageGzip ? JSON.parse(gunzipSync(Buffer.from(record.pageGzip, 'base64')).toString('utf8')) : null,
      retryAfter: record.failedAt ? Date.parse(record.failedAt) + failedRetryMs : 0
    };
  }

  function put(url, change) {
    const key = canonicalUrl(url);
    if (!key) throw new Error('Article cache needs a valid URL');
    const record = { url, ...change };
    appendFileSync(path, `${JSON.stringify(record)}\n`);
    entries.set(key, { ...entries.get(key), ...record });
  }

  return {
    get,
    putArticle(url, article) { put(url, { article, failedAt: null }); },
    putPage(url, page) { put(url, { pageGzip: gzipSync(JSON.stringify(page)).toString('base64'), fetchedAt: new Date().toISOString(), failedAt: null }); },
    putFailure(url) { put(url, { failedAt: new Date().toISOString() }); }
  };
}
