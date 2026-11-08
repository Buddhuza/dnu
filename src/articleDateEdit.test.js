import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEditedArticleDate } from './articleDateEdit.js';

test('edited article dates keep the original Vienna time and accept the displayed format', () => {
  const original = '2026-11-08T07:45:00.000Z';
  assert.equal(parseEditedArticleDate('08 Nov 26', original), original);
  assert.equal(parseEditedArticleDate('09 Nov 26', original), '2026-11-09T07:45:00.000Z');
  assert.equal(parseEditedArticleDate('2026-11-09', original), '2026-11-09T07:45:00.000Z');
});

test('edited article dates reject invalid or ambiguous dates', () => {
  assert.equal(parseEditedArticleDate('31 Feb 26', '2026-11-08T07:45:00Z'), '');
  assert.equal(parseEditedArticleDate('11/09/26', '2026-11-08T07:45:00Z'), '');
});
