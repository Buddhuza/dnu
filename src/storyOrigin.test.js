import test from 'node:test';
import assert from 'node:assert/strict';
import { storyOrigin } from './storyOrigin.js';
import legacyFeedrunUrls from '../data/legacy-feedrun-urls.json' with { type: 'json' };

test('edit underline provenance follows the story through its saved fields', () => {
  assert.equal(storyOrigin({ ingestMethod: 'feedrun', url: 'https://example.com/feed' }), 'feedrun');
  assert.equal(storyOrigin({ url: legacyFeedrunUrls[0] }), 'feedrun');
  assert.equal(storyOrigin({ fromSpreadsheet: true, url: 'https://example.com/import' }), 'import');
  assert.equal(storyOrigin({ sourceId: 'manual', url: 'https://example.com/add' }), 'add');
  assert.equal(storyOrigin({ url: 'https://example.com/unknown' }), 'other');
});
