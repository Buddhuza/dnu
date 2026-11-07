import test from 'node:test';
import assert from 'node:assert/strict';
import { selectWeekendStories, viennaSchedule } from './weekendEdition.js';

test('weekend duplicates retain the international agency account', () => {
  const local = { id: 'local', sourceName: 'Tirana Times', title: 'Albania PM resigns after corruption protests in Tirana', publishedAt: '2026-11-07T08:00:00Z' };
  const global = { id: 'global', sourceName: 'Reuters', title: 'Albania PM resigns after corruption protests in Tirana', publishedAt: '2026-11-07T09:00:00Z' };
  const other = { id: 'other', sourceName: 'N1', title: 'Serbia and Kosovo agree new border crossing', publishedAt: '2026-11-07T09:00:00Z' };
  const result = selectWeekendStories([local, other, global]);
  assert.deepEqual(result.articles.map(article => article.id), ['global', 'other']);
  assert.equal(result.removed[0].preferred.id, 'global');
});

test('Vienna schedule handles summer and winter UTC offsets', () => {
  assert.deepEqual(viennaSchedule(new Date('2026-07-04T05:00:00Z')), { date: '2026-07-04', hour: 7, minute: 0, weekend: true });
  assert.deepEqual(viennaSchedule(new Date('2026-11-07T06:00:00Z')), { date: '2026-11-07', hour: 7, minute: 0, weekend: true });
});
