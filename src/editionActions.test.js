import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeImportedArticles, appendEditionStories, latestCollectionArticles, removeStoryFromEdition, removeStoryFromConfig } from './editionActions.js';

test('an import adds new URLs and keeps matching existing stories untouched', () => {
  const existing = [
    { id: 'older', url: 'https://example.com/story?utm_source=old', title: 'Old headline' },
    { id: 'retained', url: 'https://example.com/other', title: 'Other story' }
  ];
  const incoming = [
    { id: 'sheet-1', url: 'https://example.com/story', title: 'Updated headline' },
    { id: 'sheet-2', url: 'https://example.com/new', title: 'New story' }
  ];
  assert.deepEqual(mergeImportedArticles(existing, incoming).map(({ id, title }) => [id, title]), [
    ['older', 'Old headline'], ['retained', 'Other story'], ['sheet-2', 'New story']
  ]);
});

test('a later FEEDRUN appends stories and keeps the older edition and coverage span', () => {
  const old = { windowStart: '2026-11-01T00:00:00Z', windowEnd: '2026-11-02T00:00:00Z', articles: [{ id: 'older', url: 'https://example.com/older' }] };
  const fresh = { windowStart: '2026-11-02T00:00:00Z', windowEnd: '2026-11-03T00:00:00Z', articles: [
    { id: 'repeat', url: 'https://example.com/older?utm_source=feed' },
    { id: 'manual-repeat', url: 'https://example.com/manual' },
    { id: 'new', url: 'https://example.com/new' }
  ] };
  const merged = appendEditionStories(old, fresh, ['https://example.com/manual']);
  assert.deepEqual(merged.articles.map(article => article.id), ['older', 'new']);
  assert.equal(Date.parse(merged.windowStart), Date.parse(old.windowStart));
  assert.equal(Date.parse(merged.windowEnd), Date.parse(fresh.windowEnd));
  assert.equal(merged.latestCollectionWindowStart, fresh.windowStart);
});

test('publishing after Clear all stories does not resurrect older bundled stories', () => {
  const bundled = { articles: [
    { id: 'old', url: 'https://example.com/old' },
    { id: 'new', url: 'https://example.com/new' }
  ], latestCollectionArticleUrls: ['https://example.com/new'] };
  const clearedSharedEdition = { articles: [] };
  const result = appendEditionStories(clearedSharedEdition, { ...bundled, articles: latestCollectionArticles(bundled) });
  assert.deepEqual(result.articles.map(article => article.id), ['new']);
});

test('deleting a story removes it from the edition and editor settings', () => {
  const edition = { articles: [{ id: 'remove' }, { id: 'keep' }] };
  const config = { customArticles: [{ id: 'remove' }, { id: 'keep' }], articleOrder: ['keep', 'remove'], articleEdits: { remove: { title: 'Deleted' }, keep: { title: 'Kept' } }, leadOrigins: { remove: { subsection: 'Ukraine' }, keep: { subsection: 'Georgia' } } };
  assert.deepEqual(removeStoryFromEdition(edition, 'remove').articles, [{ id: 'keep' }]);
  assert.deepEqual(removeStoryFromConfig(config, 'remove'), {
    customArticles: [{ id: 'keep' }], articleOrder: ['keep'], articleEdits: { keep: { title: 'Kept' } }, leadOrigins: { keep: { subsection: 'Georgia' } }
  });
});
