import { writeFile } from 'node:fs/promises';
import { collectFeed, FEED_URLS } from '../server/feeds.js';
import sources from '../sources.json' with { type: 'json' };

const endedAt = new Date();
const startedAt = new Date(endedAt.getTime() - 24 * 60 * 60 * 1000);
const sourceById = new Map(sources.map(source => [source.id, source]));
const audit = await Promise.all(Object.entries(FEED_URLS).map(async ([id, feedUrl]) => {
  const source = sourceById.get(id);
  try {
    const result = await collectFeed(source);
    const listed = result.data.json.articles;
    const inWindow = listed.filter(article => {
      const time = Date.parse(article.publishedAt);
      return time >= startedAt.getTime() && time <= endedAt.getTime();
    });
    return { source: source.name, sourceId: id, feedUrl, status: 'ok', listed: listed.length, inWindow: inWindow.length, articles: inWindow };
  } catch (error) {
    return { source: source.name, sourceId: id, feedUrl, status: 'failed', error: String(error.message || error), listed: 0, inWindow: 0, articles: [] };
  }
}));

const output = { method: 'Direct publisher RSS/Atom feeds; no Firecrawl or crawler service', startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString(), audit };
const path = process.argv[2] || 'data/direct-feed-24h-result.json';
await writeFile(path, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Saved ${path}: ${audit.filter(row => row.status === 'ok').length}/${audit.length} feeds usable; ${audit.reduce((sum, row) => sum + row.inWindow, 0)} dated items within 24 hours`);
