import test from 'node:test';
import assert from 'node:assert/strict';
import { clearNativeDraft, nativeDraftKey, readNativeDraft, saveNativeDraft } from './nativeDraftCache.js';

test('a review draft and its editor changes survive a browser refresh until cleared', () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const snapshot = { edition: { checkedAt: '2026-11-16T10:00:00Z', articles: [{ id: 'one', title: 'Story' }] }, settings: { sections: [{ name: 'Eastern Europe' }] }, excludedStoryIds: ['two'], compiledAt: '2026-11-16T10:00:00Z' };
  assert.equal(saveNativeDraft(snapshot, storage), true);
  assert.deepEqual(readNativeDraft(storage), snapshot);
  assert.ok(data.has(nativeDraftKey));
  clearNativeDraft(storage);
  assert.equal(readNativeDraft(storage), null);
});
