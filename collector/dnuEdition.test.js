import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptSelectedArticles, dedupeNativeEvents } from './dnuEdition.js';

const registry = [{ id: 'source-83', domain: 'bbc.com', name: 'BBC' }];
const item = (title, extras = {}) => ({
  id: title, headline: title, description: '', publicSummary: 'Ministers discussed security arrangements.',
  published: '2026-11-10T09:00:00Z', source: 'BBC', sourceDomain: 'bbc.com',
  link: 'https://bbc.com/' + encodeURIComponent(title), category: 'International', country: '',
  articleBody: 'Ministers discussed security arrangements and agreed to hold further talks next month. '.repeat(5),
  ...extras
});

test('native articles use DNU country and lead headings with stable source IDs', () => {
  const selected = [
    item('Trump announces new US security talks', { country: 'United States' }),
    item('Ukraine peace talks resume', { category: 'Eastern Europe', country: 'Ukraine' })
  ];
  const { articles, rejected } = adaptSelectedArticles(selected, new Set([selected[1].id]), registry);
  assert.equal(rejected.length, 0);
  assert.deepEqual(articles.map(article => [article.sectionId, article.subsection, article.country]), [
    ['Miscellaneous', 'NORTH AMERICA', 'United States'], ['Lead stories', 'Ukraine', '']
  ]);
  assert.equal(articles[0].sourceId, 'source-83');
  assert.ok(articles[0].body.length > 25);
});

test('native adapter drops live blogs and direct OSCE publications', () => {
  const { articles, rejected } = adaptSelectedArticles([
    item('LIVE: US security talks begin'),
    item('OSCE statement on regional security', { source: 'OSCE', sourceDomain: 'osce.org', link: 'https://news.google.com/rss/articles/example' })
  ], new Set(), registry);
  assert.equal(articles.length, 0);
  assert.match(rejected[0].reason, /Live blogs/);
  assert.match(rejected[1].reason, /OSCE publication/);
});

test('native event deduplication keeps the international account of a repeated event', () => {
  const stories = [
    { id: 'regional', title: 'Hegseth faces impeachment effort over Iran war', sourceName: 'Gazeta Express', body: '', subsection: 'NORTH AMERICA' },
    { id: 'international', title: 'US defence chief Hegseth faces impeachment push', sourceName: 'DW', body: 'A full article body.', subsection: 'NORTH AMERICA' }
  ];
  const result = dedupeNativeEvents(stories);
  assert.deepEqual(result.articles.map(article => article.id), ['international']);
  assert.equal(result.removed.length, 1);
});
