import test from 'node:test';
import assert from 'node:assert/strict';
import { currentDailyUpdate } from './daily.js';

test('daily stream drops articles outside the rolling 24-hour window', () => {
  const now = Date.parse('2026-10-09T22:00:00Z');
  const snapshot = {
    articles: [
      { sourceId: 'recent', sourceName: 'Recent News', publishedAt: '2026-10-09T21:00:00Z' },
      { sourceId: 'old', sourceName: 'Old News', publishedAt: '2026-10-08T21:59:59Z' }
    ],
    sourceOutcomes: [
      { id: 'recent', name: 'Recent News', status: 'collected' },
      { id: 'old', name: 'Old News', status: 'collected' }
    ]
  };
  const update = currentDailyUpdate(snapshot, now);
  assert.equal(update.articles.length, 1);
  assert.equal(update.sourceOutcomes[1].status, 'no selected article remains in the current 24-hour window');
});
