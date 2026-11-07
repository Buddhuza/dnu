import test from 'node:test';
import assert from 'node:assert/strict';
import { collectionReportRows } from './collectionReportRows.js';

test('collection report keeps source-check status separate from stories imported later', () => {
  const sources = [
    { id: 'one', name: 'AP', url: 'https://apnews.com/' },
    { id: 'two', name: 'BBC', url: 'https://bbc.com/' },
    { id: 'three', name: 'DW', url: 'https://dw.com/' }
  ];
  const rows = collectionReportRows(sources, [{ sourceId: 'one' }, { sourceId: 'one' }], [
    { id: 'one', status: 'not-checked', reason: 'Outside the direct-feed source set.' },
    { id: 'two', status: 'collected', reason: 'Three article pages checked.' },
    { id: 'three', status: 'failed', reason: 'Publisher returned HTTP 403.' }
  ]);
  assert.deepEqual(rows.map(row => [row.status, row.stories]), [
    ['Not checked', 2], ['Checked', 0], ['Failed', 0]
  ]);
  assert.match(rows[2].reason, /HTTP 403/);
});
