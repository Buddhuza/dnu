import test from 'node:test';
import assert from 'node:assert/strict';
import { googleNewsUrl, normalizeArticles, scrapeHeadlines, undatedCandidates, reviewedArticle, customSourceFromRequest } from './news.js';

const source = { id: 'source-1', name: 'Test News', group: 'Test', url: 'https://example.com/news/' };
const now = Date.parse('2026-10-09T12:00:00Z');

test('keeps only dated, matching headlines from the last 48 hours', () => {
  const payload = { data: { json: { articles: [
    { title: 'Security meeting held today', url: '/story-1', publishedAt: '2026-10-09T10:00:00Z' },
    { title: 'Security meeting held yesterday', url: '/story-2', publishedAt: '2026-10-07T10:00:00Z' },
    { title: 'Security rumor', url: '/story-3' },
    { title: 'Security date only', url: '/story-5', publishedAt: '2026-10-09' },
    { title: 'Security sports event', url: '/story-4', publishedAt: '2026-10-09T09:00:00Z' },
    { title: 'Security meeting held today', url: '/story-1', publishedAt: '2026-10-09T10:00:00Z' }
  ] } } };
  const result = normalizeArticles(payload, source, now, ['security'], ['sports']);
  assert.equal(result.length, 1);
  assert.equal(result[0].url, 'https://example.com/story-1');
});

test('Google News query uses the selected phrases and two-day window', () => {
  const url = new URL(googleNewsUrl(['security', 'election']));
  assert.equal(url.hostname, 'news.google.com');
  assert.match(url.searchParams.get('q'), /when:2d/);
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

test('undated matching links can be checked on their original article pages', () => {
  const payload = { data: { json: { articles: [
    { title: 'Security talks continue', url: '/story-1' },
    { title: 'Election vote opens', absoluteUrl: 'https://example.com/story-2', publishedAt: '2026-10-09T00:00:00Z' },
    { title: 'Sports results', url: '/sports' },
    { title: 'Security elsewhere', url: 'https://other.example/story' }
  ] } } };
  const candidates = undatedCandidates(payload, source, ['security', 'election']);
  assert.deepEqual(candidates.map(x => x.url), ['https://example.com/story-1', 'https://example.com/story-2']);
  assert.equal(normalizeArticles(payload, source, now, ['election']).length, 0);
  const verified = reviewedArticle({ data: { metadata: { publishedTime: '2026-10-09T10:00:00Z', ogTitle: 'Security talks continue' }, json: { summary: 'The ministers agreed to meet again.' } } }, source, candidates[0].url, now);
  assert.equal(verified.publishedAt, '2026-10-09T10:00:00.000Z');
  assert.equal(verified.summary, 'The ministers agreed to meet again.');
  assert.equal(reviewedArticle({ data: { metadata: { publishedTime: '2026-10-07T10:00:00Z', ogTitle: 'Old story' } } }, source, candidates[0].url, now), null);
});

test('manual source accepts a public HTTPS news site and rejects local targets', () => {
  const input = { id: 'manual-source-123', name: 'New Agency', group: 'Europe', url: 'https://news.example.org/latest' };
  assert.equal(customSourceFromRequest(input)?.url, input.url);
  assert.equal(customSourceFromRequest({ ...input, url: 'https://localhost/private' }), null);
  assert.equal(customSourceFromRequest({ ...input, url: 'http://news.example.org/' }), null);
  assert.equal(customSourceFromRequest({ ...input, url: 'https://127.0.0.1/' }), null);
});
