import test from 'node:test';
import assert from 'node:assert/strict';
import { importDirectArticle } from './importClient.js';

test('public-page import sends one article to Firecrawl and returns a placed story', async () => {
  let request;
  const fetchStub = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ success: true, data: { metadata: { ogTitle: 'OSCE chair to visit Armenia', publishedTime: '2026-10-14T10:00:00Z', language: 'en' }, json: { summary: 'The chair will discuss the peace process in Yerevan.', section: 'South Caucasus', subsection: 'Armenia' } } }) };
  };
  const story = await importDirectArticle('https://example.org/article', 'test-key', [], fetchStub);
  assert.equal(request.url, 'https://api.firecrawl.dev/v2/scrape');
  assert.equal(request.options.headers.Authorization, 'Bearer test-key');
  assert.equal(JSON.parse(request.options.body).url, 'https://example.org/article');
  assert.equal(story.subsection, 'Armenia');
  assert.equal(story.reviewed, true);
});
