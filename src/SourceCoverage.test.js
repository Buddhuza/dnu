import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceCoverageRows } from './sourceCoverageRows.js';

test('source audit distinguishes included, checked, and unreviewed sites', () => {
  const sources = [
    { id: 'ap', name: 'AP', url: 'https://apnews.com/' },
    { id: 'bbc', name: 'BBC', url: 'https://bbc.com/' },
    { id: 'dw', name: 'DW', url: 'https://dw.com/' },
    { id: 'blocked', name: 'Blocked', url: 'https://example.com/' }
  ];
  const rows = sourceCoverageRows(sources, [{ sourceId: 'ap' }], [
    { id: 'bbc', status: 'no verified article', reason: 'Date unavailable on article page.' },
    { id: 'blocked', status: 'failed', reason: 'Firecrawl returned HTTP 403.' }
  ]);
  assert.deepEqual(rows.map(row => row.status), ['Included', 'Checked, no verified story', 'Not checked', 'Fetch failed']);
  assert.match(rows[1].reason, /Date unavailable/);
  assert.match(rows[2].reason, /Not checked/);
  assert.match(rows[3].reason, /HTTP 403/);
});
