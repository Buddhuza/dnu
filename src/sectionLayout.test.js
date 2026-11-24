import test from 'node:test';
import assert from 'node:assert/strict';
import { assignSectionsToColumns } from './sectionLayout.js';

test('sections start in reading order while shorter columns receive the next section', () => {
  const sections = ['Lead stories', 'South Eastern Europe', 'Eastern Europe', 'South Caucasus', 'Central Asia', 'Miscellaneous']
    .map(sectionId => ({ sectionId, subsections: [['', [{}]]] }));
  const heights = { 'Lead stories': 300, 'South Eastern Europe': 500, 'Eastern Europe': 180, 'South Caucasus': 240, 'Central Asia': 140, Miscellaneous: 200 };
  const columns = assignSectionsToColumns(sections, heights, 2);
  const bottoms = [0, 0];
  const starts = sections.map(({ sectionId }, index) => {
    const start = bottoms[columns[index]];
    bottoms[columns[index]] += heights[sectionId];
    return start;
  });
  assert.deepEqual(columns.slice(0, 2), [0, 1]);
  assert.deepEqual(starts, [...starts].sort((a, b) => a - b));
  assert.ok(Math.abs(bottoms[0] - bottoms[1]) <= Math.max(...Object.values(heights)));
});

test('one to four columns keep sections in their requested reading order', () => {
  const sections = Array.from({ length: 6 }, (_, index) => ({ sectionId: String(index), subsections: [] }));
  for (const count of [1, 2, 3, 4]) {
    const columns = assignSectionsToColumns(sections, {}, count);
    assert.deepEqual(columns.slice(0, count), Array.from({ length: count }, (_, index) => index));
    assert.ok(columns.every(column => column >= 0 && column < count));
  }
});

test('three reading columns are used by default', () => {
  const sections = Array.from({ length: 4 }, (_, index) => ({ sectionId: String(index), subsections: [] }));
  assert.deepEqual(assignSectionsToColumns(sections).slice(0, 3), [0, 1, 2]);
});
