import { writeFile } from 'node:fs/promises';
import { load } from 'cheerio';
import { collectFeed, FEED_URLS } from '../server/feeds.js';
import { extractArticleBody } from '../server/articleBody.js';
import { publicationTimestamp } from '../server/importArticle.js';
import { excludedHeadlineReason } from '../src/headlinePolicy.js';
import sources from '../sources.json' with { type: 'json' };

const windowHours = Number(process.env.DIRECT_FEED_WINDOW_HOURS || 36);
if (!Number.isInteger(windowHours) || windowHours < 1 || windowHours > 168) throw new Error('DIRECT_FEED_WINDOW_HOURS must be an integer from 1 to 168.');
const resultPath = process.env.DIRECT_FEED_RESULT_PATH || 'data/direct-feed-36h-result.json';
const end = new Date();
const start = new Date(end.getTime() - windowHours * 60 * 60 * 1000);
const sourceById = new Map(sources.map(source => [source.id, source]));
const feedAlternates = {
  'source-79': ['https://www.rferl.org/rss/'],
  'source-89': ['https://english.radio.cz/rss.xml'],
  'source-101': ['https://feeds.cnn.com/rss/edition_world.rss', 'http://rss.cnn.com/rss/edition_world.rss'],
  'source-165': ['https://www.voanews.com/rss/']
};
const relevant = /\b(OSCE|Ukraine|Ukrainian|Russia|Russian|Iran|Israeli?|Palestinian|Gaza|war|attack|strike|drone|missile|ceasefire|peace|military|security|defen[cs]e|NATO|G20|EU|UN|sanction|border|protest|government|president|minister|parliament|election|court|diplomat|embassy|terror|Kosovo|Serbia|Albania|Georgia|Armenia|Azerbaijan|Moldova|Belarus|Kazakhstan|Kyrgyzstan|Tajikistan|Turkmenistan|Uzbekistan|Syria|Lebanon|Türkiye|Turkey|China|North Korea|Poland|France|Germany|Britain|US|Trump|Putin|Zelenskyy|Oleshky)\b/i;

const feeds = await Promise.all(Object.entries(FEED_URLS).map(async ([sourceId, feedUrl]) => {
  const source = sourceById.get(sourceId);
  const attempts = [];
  for (const candidate of [feedUrl, ...(feedAlternates[sourceId] || [])]) {
    try {
      const { data } = await collectFeed(source, fetch, candidate);
      const items = data.json.articles.filter(item => Date.parse(item.publishedAt) >= start.getTime() && Date.parse(item.publishedAt) <= end.getTime());
      return { sourceId, sourceName: source.name, status: 'ok', feedUrl: candidate, listed: data.json.articles.length, newestItemAt: data.json.articles.map(item => item.publishedAt).sort().at(-1), inWindow: items.length, attempts, items };
    } catch (error) { attempts.push({ feedUrl: candidate, error: String(error.message || error) }); }
  }
  return { sourceId, sourceName: source.name, status: 'failed', feedUrl, listed: 0, inWindow: 0, attempts, items: [] };
}));

const candidates = feeds.flatMap(feed => feed.items.map(item => ({ ...item, sourceId: feed.sourceId, sourceName: feed.sourceName })))
  .filter(item => relevant.test(item.title) && !excludedHeadlineReason(item.title, '', item.url))
  .filter(item => !/\/(?:video|videos|podcast|podcasts|live|liveblog|newsletters)(?:\/|$)/i.test(new URL(item.url).pathname));

let next = 0;
const results = Array(candidates.length);
async function worker() {
  while (next < candidates.length) {
    const index = next++;
    const item = candidates[index];
    try {
      const response = await fetch(item.url, { headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0 (compatible; DNUFeedReader/1.0)' }, signal: AbortSignal.timeout(18000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      if (html.length > 4_000_000) throw new Error('Page too large');
      const $ = load(html);
      const dates = [
        $('meta[property="article:published_time"]').attr('content'),
        $('meta[name="date"]').attr('content'),
        $('meta[name="pubdate"]').attr('content'),
        $('meta[name="cXenseParse:publishtime"]').attr('content'),
        $('time[datetime]').first().attr('datetime'),
        ...[...html.matchAll(/"datePublished"\s*:\s*"([^"]+)"/g)].slice(0, 3).map(match => match[1])
      ];
      const pageDate = publicationTimestamp(...dates);
      const body = extractArticleBody({ html, metadata: { sourceURL: item.url } }, item.title);
      const words = body.split(/\s+/).filter(Boolean).length;
      results[index] = { ...item, pageDate, pageDateMatchesFeed: pageDate ? Math.abs(Date.parse(pageDate) - Date.parse(item.publishedAt)) < 24 * 60 * 60 * 1000 : false, body: words >= 60 ? body : '', bodyWords: words, status: pageDate && words >= 60 ? 'verified' : 'incomplete' };
    } catch (error) {
      results[index] = { ...item, status: 'failed', error: String(error.message || error) };
    }
  }
}
await Promise.all(Array.from({ length: 8 }, () => worker()));
const output = { method: 'Direct publisher feeds and article pages; no Firecrawl or crawler service', windowHours, windowStart: start.toISOString(), windowEnd: end.toISOString(), feeds, candidateCount: candidates.length, articles: results };
await writeFile(resultPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ windowStart: output.windowStart, windowEnd: output.windowEnd, feedItems: feeds.reduce((sum, feed) => sum + feed.inWindow, 0), candidates: candidates.length, verified: results.filter(item => item.status === 'verified' && item.pageDateMatchesFeed).length, failed: results.filter(item => item.status === 'failed').length }));
