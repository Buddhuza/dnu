import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeImportedArticles, removeStoryFromEdition, removeStoryFromConfig } from './editionActions.js';

test('an import adds stories and replaces a matching URL while keeping its editor identity', () => {
  const existing = [
    { id: 'older', url: 'https://example.com/story?utm_source=old', title: 'Old headline' },
    { id: 'retained', url: 'https://example.com/other', title: 'Other story' }
  ];
  const incoming = [
    { id: 'sheet-1', url: 'https://example.com/story', title: 'Updated headline' },
    { id: 'sheet-2', url: 'https://example.com/new', title: 'New story' }
  ];
  assert.deepEqual(mergeImportedArticles(existing, incoming).map(({ id, title }) => [id, title]), [
    ['older', 'Updated headline'], ['retained', 'Other story'], ['sheet-2', 'New story']
  ]);
});

test('deleting a story removes it from the edition and editor settings', () => {
  const edition = { articles: [{ id: 'remove' }, { id: 'keep' }] };
  const config = { customArticles: [{ id: 'remove' }, { id: 'keep' }], articleOrder: ['keep', 'remove'], articleEdits: { remove: { title: 'Deleted' }, keep: { title: 'Kept' } }, leadOrigins: { remove: { subsection: 'Ukraine' }, keep: { subsection: 'Georgia' } } };
  assert.deepEqual(removeStoryFromEdition(edition, 'remove').articles, [{ id: 'keep' }]);
  assert.deepEqual(removeStoryFromConfig(config, 'remove'), {
    customArticles: [{ id: 'keep' }], articleOrder: ['keep'], articleEdits: { keep: { title: 'Kept' } }, leadOrigins: { keep: { subsection: 'Georgia' } }
  });
});
