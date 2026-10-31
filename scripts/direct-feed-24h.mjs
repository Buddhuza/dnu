import { writeFile } from 'node:fs/promises';
import { collectFeed, FEED_URLS } from '../server/feeds.js';
import sources from '../sources.json' with { type: 'json' };

const endedAt = new Date();
const startedAt = new Date(endedAt.getTime() - 24 * 60 * 60 * 1000);
const sourceById = new Map(sources.map(source => [source.id, source]));
const alternateFeeds = {
  'source-79': ['https://www.rferl.org/rss/', 'https://www.rferl.org/api/zrqite'],
  'source-89': ['https://english.radio.cz/rss.xml', 'https://english.radio.cz/rss/news'],
  'source-101': ['https://feeds.cnn.com/rss/edition_world.rss', 'http://rss.cnn.com/rss/edition_world.rss'],
  'source-165': ['https://www.voanews.com/rss/', 'https://www.voanews.com/api/zrqite']
};
const audit = await Promise.all(Object.entries(FEED_URLS).map(async ([id, feedUrl]) => {
  const source = sourceById.get(id);
  const attempts = [];
  for (const candidate of [feedUrl, ...(alternateFeeds[id] || [])]) try {
    const result = await collectFeed(source, fetch, candidate);
    const listed = result.data.json.articles;
    const inWindow = listed.filter(article => {
      const time = Date.parse(article.publishedAt);
      return time >= startedAt.getTime() && time <= endedAt.getTime();
    });
    return { source: source.name, sourceId: id, feedUrl: candidate, status: 'ok', listed: listed.length, newestItemAt: listed.map(item => item.publishedAt).sort().at(-1), inWindow: inWindow.length, attempts, articles: inWindow };
  } catch (error) {
    attempts.push({ url: candidate, error: String(error.message || error) });
  }
  return { source: source.name, sourceId: id, feedUrl, status: 'failed', attempts, listed: 0, inWindow: 0, articles: [] };
}));

const output = { method: 'Direct publisher RSS/Atom feeds; no Firecrawl or crawler service', startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString(), audit };
const path = process.argv[2] || 'data/direct-feed-24h-result.json';
await writeFile(path, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Saved ${path}: ${audit.filter(row => row.status === 'ok').length}/${audit.length} feeds usable; ${audit.reduce((sum, row) => sum + row.inWindow, 0)} dated items within 24 hours`);
