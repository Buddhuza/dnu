import test from 'node:test';
import assert from 'node:assert/strict';
import { googleNewsUrl, normalizeArticles, scrapeHeadlines } from './news.js';

const source = { id: 'source-1', name: 'Test News', group: 'Test', url: 'https://example.com/news/' };
const now = Date.parse('2026-10-09T12:00:00Z');

test('keeps only dated, matching headlines from the last 24 hours', () => {
  const payload = { data: { json: { articles: [
    { title: 'Security meeting held today', url: '/story-1', publishedAt: '2026-10-09T10:00:00Z' },
    { title: 'Security meeting held yesterday', url: '/story-2', publishedAt: '2026-10-08T10:00:00Z' },
    { title: 'Security rumor', url: '/story-3' },
    { title: 'Security date only', url: '/story-5', publishedAt: '2026-10-09' },
    { title: 'Security sports event', url: '/story-4', publishedAt: '2026-10-09T09:00:00Z' },
    { title: 'Security meeting held today', url: '/story-1', publishedAt: '2026-10-09T10:00:00Z' }
  ] } } };
  const result = normalizeArticles(payload, source, now, ['security'], ['sports']);
  assert.equal(result.length, 1);
  assert.equal(result[0].url, 'https://example.com/story-1');
});

test('Google News query uses the selected phrases and one-day window', () => {
  const url = new URL(googleNewsUrl(['security', 'election']));
  assert.equal(url.hostname, 'news.google.com');
  assert.match(url.searchParams.get('q'), /when:1d/);
  assert.match(url.searchParams.get('q'), /election/);
});

test('Firecrawl request sends the fixed source URL and bearer credential', async () => {
  let called;
  const fetchStub = async (url, options) => {
    called = { url, options };
    return { ok: true, json: async () => ({ success: true, data: { json: { articles: [] } } }) };
  };
  await scrapeHeadlines(source, ['security'], 'test-key', fetchStub);
  assert.equal(called.url, 'https://api.firecrawl.dev/v2/scrape');
  assert.equal(called.options.headers.Authorization, 'Bearer test-key');
  assert.equal(JSON.parse(called.options.body).url, source.url);
});
