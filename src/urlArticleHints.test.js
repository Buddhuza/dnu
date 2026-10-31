import test from 'node:test';
import assert from 'node:assert/strict';
import { articleHintsFromUrl, articleHintsFromHtml, articleHintsFromPage } from './urlArticleHints.js';

test('article URL suggests outlet, readable headline and publication date without a network request', () => {
  const hints = articleHintsFromUrl('https://www.reuters.com/world/europe/exclusive-eu-leaders-agree-security-package-2026-10-31/',
    [{ name: 'Reuters', url: 'https://www.reuters.com/' }]);
  assert.deepEqual(hints, { title: 'EU leaders agree security package', sourceName: 'Reuters', summary: '', date: '2026-10-31' });
});

test('opaque links do not invent an article title or publisher', () => {
  const hints = articleHintsFromUrl('https://news.google.com/rss/articles/CBMiygFBVV95cUxO?oc=5');
  assert.equal(hints.title, '');
  assert.equal(hints.sourceName, '');
});

test('well-known publisher hostnames supply a useful agency name across domains', () => {
  assert.equal(articleHintsFromUrl('https://www.bbc.co.uk/news/articles/cx123456').sourceName, 'BBC');
});

test('permitted publisher metadata can supply a headline, description and date directly', async () => {
  const html = '<html><head><meta content="Exclusive: NATO ministers agree new border plan" property="og:title"><meta name="description" content="The ministers will meet in Brussels next month to review the security measures."><meta property="og:site_name" content="Example News"><meta property="article:published_time" content="2026-10-30T09:00:00Z"></head></html>';
  assert.deepEqual(articleHintsFromHtml(html), { title: 'NATO ministers agree new border plan', sourceName: 'Example News', summary: 'The ministers will meet in Brussels next month to review the security measures', date: '2026-10-30' });
  const hints = await articleHintsFromPage('https://example.com/article', async () => new Response(html, { headers: { 'content-type': 'text/html' } }));
  assert.equal(hints.title, 'NATO ministers agree new border plan');
});
