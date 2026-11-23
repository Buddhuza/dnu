import test from 'node:test';
import assert from 'node:assert/strict';
import { assignSectionsToColumns } from './sectionLayout.js';

test('sections start in reading order while shorter columns receive the next section', () => {
  const sections = ['Lead stories', 'South Eastern Europe', 'Eastern Europe', 'South Caucasus', 'Central Asia', 'Miscellaneous']
    .map(sectionId => ({ sectionId, subsections: [['', [{}]]] }));
  const heights = { 'Lead stories': 300, 'South Eastern Europe': 500, 'Eastern Europe': 180, 'South Caucasus': 240, 'Central Asia': 140, Miscellaneous: 200 };
  const columns = assignSectionsToColumns(sections, heights);
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
