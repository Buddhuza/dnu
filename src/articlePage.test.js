import test from 'node:test';
import assert from 'node:assert/strict';
import { articleFieldsFromPage, fetchArticlePage } from './articlePage.js';
import { extractArticleBody } from '../server/articleBody.js';

const paragraph = 'Officials in Tbilisi confirmed on Tuesday that the new agreement with regional partners will take effect next month after parliament approved it.';
const html = `<html><head><title>Ignored</title>
<meta property="og:title" content="Georgia signs transit agreement with neighbours">
<meta property="og:site_name" content="Example News">
<meta property="article:published_time" content="2026-11-23T22:30:00Z">
</head><body><nav><p>${'Navigation link text that should never be used as article body. '.repeat(2)}</p></nav>
<article><h1>Georgia signs transit agreement with neighbours</h1>${[1, 2, 3].map(() => `<p>${paragraph}</p>`).join('')}</article></body></html>`;

test('page fields include headline, agency, Vienna date, exact time and full text', () => {
  const fields = articleFieldsFromPage(html, 'https://example.com/world/georgia-transit', extractArticleBody);
  assert.equal(fields.title, 'Georgia signs transit agreement with neighbours');
  assert.equal(fields.sourceName, 'Example News');
  assert.equal(fields.date, '2026-11-23');
  assert.equal(fields.publishedAt, '2026-11-23T22:30:00.000Z');
  assert.equal(fields.text.split('\n\n').length, 3);
  assert.ok(!fields.text.includes('Navigation'));
});

test('a UTC late-evening time is converted to the following Vienna date', () => {
  const late = html.replace('2026-11-23T22:30:00Z', '2026-11-23T23:30:00Z');
  assert.equal(articleFieldsFromPage(late, 'https://example.com/a', extractArticleBody).date, '2026-11-24');
});

test('pages without article text or time leave those fields blank', () => {
  const fields = articleFieldsFromPage('<html><head><meta property="og:title" content="Short teaser headline here"></head><body><p>Subscribe</p></body></html>', 'https://example.com/a', extractArticleBody);
  assert.equal(fields.text, '');
  assert.equal(fields.publishedAt, null);
  assert.equal(fields.date, '');
});

test('fetchArticlePage surfaces the function error message', async () => {
  const client = { functions: { invoke: async () => ({ data: null, error: { context: { json: async () => ({ error: 'The publisher refused automated access (HTTP 403). Paste the text yourself.' }) } } }) } };
  await assert.rejects(fetchArticlePage(client, 'https://example.com/a'), /refused automated access/);
  await assert.rejects(fetchArticlePage(null, 'https://example.com/a'), /sign-in/);
  const ok = { functions: { invoke: async (name, options) => { assert.equal(name, 'fetch-article-page'); assert.deepEqual(options.body, { url: 'https://example.com/a' }); return { data: { url: 'https://example.com/b', html: '<html></html>' }, error: null }; } } };
  assert.deepEqual(await fetchArticlePage(ok, 'https://example.com/a'), { url: 'https://example.com/b', html: '<html></html>' });
});
