import test from 'node:test';
import assert from 'node:assert/strict';
import { collectFeed, collectFallbackFeed, parseFeed } from './feeds.js';
import { normalizeArticles } from './news.js';

test('RSS headlines use dated publisher entries without Firecrawl', async () => {
  const source = { id: 'source-83', name: 'BBC', group: 'Miscl', url: 'https://www.bbc.com/news' };
  const now = Date.parse('2026-10-11T18:00:00Z');
  const xml = '<rss><channel><item><title>Security talks resume</title><link>https://www.bbc.com/news/example</link><pubDate>Sun, 11 Oct 2026 12:00:00 GMT</pubDate></item><item><title>Undated story</title><link>https://www.bbc.com/news/other</link></item></channel></rss>';
  const payload = await collectFeed(source, async url => {
    assert.match(url, /feeds\.bbci\.co\.uk/);
    return { ok: true, text: async () => xml };
  });
  assert.equal(payload.collectionMethod, 'feed');
  assert.deepEqual(normalizeArticles(payload, source, now, ['security']), [{
    id: 'https://www.bbc.com/news/example', title: 'Security talks resume', summary: '', url: 'https://www.bbc.com/news/example', publishedAt: '2026-10-11T12:00:00.000Z', sourceId: 'source-83', sourceName: 'BBC', group: 'Miscl'
  }]);
});

test('Atom headlines and article URLs are parsed', () => {
  const xml = '<feed><entry><title>Parliament votes</title><link rel="alternate" href="https://example.com/story"/><published>2026-10-11T12:00:00Z</published></entry></feed>';
  assert.deepEqual(parseFeed(xml), [{ title: 'Parliament votes', url: 'https://example.com/story', publishedAt: '2026-10-11T12:00:00.000Z' }]);
});

test('fallback feed probes common publisher feed URLs', async () => {
  const source = { id: 'custom', name: 'Example', url: 'https://example.com/news' };
  const xml = '<rss><channel><item><title>Security talks resume</title><link>https://example.com/story</link><pubDate>Sun, 11 Oct 2026 12:00:00 GMT</pubDate></item></channel></rss>';
  const payload = await collectFallbackFeed(source, async url => ({ ok: url.endsWith('/rss.xml'), status: 404, text: async () => xml }));
  assert.equal(payload.feedUrl, 'https://example.com/rss.xml');
  assert.equal(payload.data.json.articles.length, 1);
});

test('fallback feed tries a second feed when the first has no matching news', async () => {
  const source = { id: 'custom', name: 'Example', group: 'Test', url: 'https://example.com/news' };
  const xml = title => `<rss><channel><item><title>${title}</title><link>https://example.com/story</link><pubDate>Sun, 11 Oct 2026 12:00:00 GMT</pubDate></item></channel></rss>`;
  const payload = await collectFallbackFeed(source, async url => ({ ok: true, text: async () => xml(url.endsWith('/rss.xml') ? 'Security talks' : 'Football result') }), feed => normalizeArticles(feed, source, Date.parse('2026-10-11T18:00:00Z'), ['security']).length > 0);
  assert.equal(payload.feedUrl, 'https://example.com/rss.xml');
});
