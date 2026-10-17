import { appendFileSync, existsSync, mkdirSync, readFileSync, rmdirSync, statSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { canonicalUrl, headlineKey } from './previousCoverage.js';

export function createAutoScrapeHistory(path) {
  const lockPath = `${path}.lock`;
  let urls = new Set();
  let headlines = new Map();

  function reload() {
    urls = new Set();
    headlines = new Map();
    if (!existsSync(path)) return;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        const url = canonicalUrl(entry.url);
        const title = headlineKey(entry.title);
        if (url) urls.add(url);
        if (title && entry.sourceId && Date.now() - Date.parse(entry.attemptedAt) < 72 * 60 * 60 * 1000) headlines.set(`${entry.sourceId}:${title}`, true);
      } catch { /* Ignore an incomplete final line after a crash. */ }
    }
  }

  function reason(article, sourceId = article.sourceId || '') {
    const url = canonicalUrl(article.url);
    if (url && urls.has(url)) return 'same URL';
    const title = headlineKey(article.title);
    return title && sourceId && headlines.has(`${sourceId}:${title}`) ? 'same headline' : null;
  }

  async function claim(article, { batchId = 'automatic', sourceId = '', force = false } = {}) {
    let locked = false;
    for (let attempt = 0; attempt < 300; attempt++) {
      try { mkdirSync(lockPath); locked = true; break; }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        try { if (Date.now() - statSync(lockPath).mtimeMs > 120000) rmdirSync(lockPath); } catch { /* Another process may have released it. */ }
        await delay(100);
      }
    }
    if (!locked) throw new Error('The automatic scrape history is locked by another collection process.');
    try {
      reload();
      const alreadySeen = reason(article, sourceId);
      if (alreadySeen && !force) return { claimed: false, reason: alreadySeen };
      if (!alreadySeen) {
        appendFileSync(path, `${JSON.stringify({ url: article.url, title: article.title || '', sourceId, batchId, attemptedAt: new Date().toISOString() })}\n`);
        const url = canonicalUrl(article.url);
        const title = headlineKey(article.title);
        if (url) urls.add(url);
        if (title && sourceId) headlines.set(`${sourceId}:${title}`, true);
      }
      return { claimed: true, reason: alreadySeen };
    } finally { rmdirSync(lockPath); }
  }

  reload();
  return { reason, claim, reload };
}
