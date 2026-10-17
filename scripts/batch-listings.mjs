import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fallbackListingUrl } from '../server/news.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const allSources = JSON.parse(readFileSync(join(root, 'sources.json'), 'utf8'));
const alternate = process.env.COLLECTION_LISTING_MODE === 'alternate';
const day = process.env.COLLECTION_DAY || new Date().toISOString().slice(0, 10);
const runId = process.env.COLLECTION_RUN_ID || day;
const checkpoint = alternate ? JSON.parse(readFileSync(join(root, `data/collection-${runId}-working.json`), 'utf8')) : null;
const sources = alternate ? allSources.filter(source => checkpoint.sources[source.id]?.status === 'primaryComplete' && fallbackListingUrl(source)) : allSources;
const path = join(root, `data/${alternate ? 'alternate-listings' : 'listings'}-${runId}.json`);
const state = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
// Reuse a very recent listing; older ones must refresh to discover new stories.
const listingPrefix = alternate ? 'alternate-listings-' : 'listings-';
for (const filename of readdirSync(join(root, 'data')).filter(name => name.startsWith(listingPrefix) && name.endsWith('.json') && name !== `${listingPrefix}${runId}.json`)) {
  const previousPath = join(root, 'data', filename);
  if (Date.now() - statSync(previousPath).mtimeMs > 10 * 60 * 1000) continue;
  try {
    const previous = JSON.parse(readFileSync(previousPath, 'utf8'));
    for (const [id, result] of Object.entries(previous)) if (result?.data && !(id in state)) state[id] = result;
  } catch { /* A concurrently written listing is not reusable. */ }
}
const key = process.env.FIRECRAWL_API_KEY;
if (!key) throw new Error('FIRECRAWL_API_KEY is not set');
const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const prompt = 'Extract English-language news article headlines linked from this page. Return an object with an articles array. For each article return title, url (absolute article URL), description only if visible on this listing page, and publishedAt as an ISO 8601 timestamp with timezone only when the exact time and timezone are visible. Also assign priority from 0 to 5 using only the visible headline and description: 5 for important OSCE, war, cross-border security or diplomacy, 4 for other external cooperation or international politics, 3 for relevant national security or politics, 0 to 2 for weakly relevant items. Include plausible article links even when the time is not visible; omit publishedAt for those. Do not turn a date-only label into a midnight timestamp. Do not invent dates, titles, descriptions, or URLs. Do not include navigation links.';
const save = () => writeFileSync(path, JSON.stringify(state, null, 2));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function request(url, options = {}) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, { ...options, headers, signal: AbortSignal.timeout(60000) });
    const body = await response.json().catch(() => ({}));
    if (response.ok && body.success !== false) return body;
    if (response.status !== 429 || attempt === 3) throw new Error(body.error || `Firecrawl HTTP ${response.status}`);
    await pause(15000 * (attempt + 1));
  }
}
for (let offset = 0; offset < sources.length; offset += 10) {
  const group = sources.slice(offset, offset + 10).filter(source => !(source.id in state));
  if (!group.length) continue;
  const byUrl = new Map(group.map(source => [alternate ? fallbackListingUrl(source) : source.listingUrl || source.url, source]));
  try {
    const created = await request('https://api.firecrawl.dev/v2/batch/scrape', { method: 'POST', body: JSON.stringify({ urls: [...byUrl.keys()], formats: [{ type: 'json', prompt }], onlyMainContent: true, timeout: 30000 }) });
    if (!created.id) throw new Error(created.error || 'Batch has no ID');
    let complete = false;
    for (let attempt = 0; attempt < 45; attempt++) {
      await pause(4000);
      const status = await request(`https://api.firecrawl.dev/v2/batch/scrape/${created.id}`);
      for (const page of status.data || []) {
        const url = page.metadata?.sourceURL || page.metadata?.url;
        const source = byUrl.get(url);
        if (source) state[source.id] = { data: page, method: 'Firecrawl batch listing' };
      }
      if (status.status === 'completed' || status.completed >= status.total) { complete = true; break; }
      if (status.status === 'failed') throw new Error(status.error || 'Batch failed');
    }
    if (!complete) throw new Error('Batch timed out');
    for (const source of group) if (!(source.id in state)) state[source.id] = { error: 'No page returned by Firecrawl batch' };
  } catch (error) {
    for (const source of group) state[source.id] = { error: error.message };
  }
  save();
  console.log(`LISTINGS ${Object.keys(state).length}/${sources.length}, ${Object.values(state).filter(item => item.data).length} returned`);
}
