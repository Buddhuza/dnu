import test from 'node:test';
import assert from 'node:assert/strict';
import { collectFeed, parseFeed } from './feeds.js';
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
