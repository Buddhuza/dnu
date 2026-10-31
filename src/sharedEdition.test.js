import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedPayload } from './sharedEdition.js';

test('shared edition includes editor changes but keeps dark mode local', () => {
  const edition = { articles: [{ id: 'story-1' }] };
  const settings = { darkMode: true, fontSize: 18, articleEdits: { 'story-1': { title: 'Revised' } } };
  const payload = sharedPayload(edition, settings, new Set(['b', 'a']), '2026-10-31T10:00:00Z');
  assert.deepEqual(payload.update, edition);
  assert.deepEqual(payload.settings, { fontSize: 18, articleEdits: settings.articleEdits });
  assert.deepEqual(payload.excluded_story_ids, ['a', 'b']);
});
