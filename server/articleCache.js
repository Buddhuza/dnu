import { appendFileSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { basename, dirname, join } from 'node:path';
import { canonicalUrl } from './previousCoverage.js';

const failedRetryMs = 6 * 60 * 60 * 1000;

// Append-only records keep verified articles and the Firecrawl page response
// available across collection runs and workspace restarts. A later record for
// the same URL updates only the supplied fields.
export function createArticleCache(path) {
  const entries = new Map();
  const directory = dirname(path);
  const stem = basename(path, '.jsonl');
  const shardPattern = new RegExp(`^${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d{4}-\\d{2}-\\d{2}(?:-\\d+)?\\.jsonl$`);
  const shards = existsSync(directory) ? readdirSync(directory).filter(name => shardPattern.test(name)).sort().map(name => join(directory, name)) : [];
  for (const file of [path, ...shards]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const record = JSON.parse(line);
        const key = canonicalUrl(record.url);
        if (key) entries.set(key, { ...entries.get(key), ...record });
      } catch { /* Ignore an incomplete final line after an interrupted write. */ }
    }
  }
  let writePath = shards.at(-1) || path;

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
    const line = `${JSON.stringify(record)}\n`;
    if (existsSync(writePath) && statSync(writePath).size + Buffer.byteLength(line) > 90_000_000) {
      const today = new Date().toISOString().slice(0, 10);
      let next = join(directory, `${stem}-${today}.jsonl`);
      for (let number = 2; existsSync(next); number++) next = join(directory, `${stem}-${today}-${number}.jsonl`);
      writePath = next;
    }
    appendFileSync(writePath, line);
    entries.set(key, { ...entries.get(key), ...record });
  }

  return {
    get,
    putArticle(url, article) { put(url, { article, failedAt: null }); },
    putPage(url, page) { put(url, { pageGzip: gzipSync(JSON.stringify(page)).toString('base64'), fetchedAt: new Date().toISOString(), extractionVersion: 2, failedAt: null }); },
    putFailure(url) { put(url, { failedAt: new Date().toISOString() }); }
  };
}
