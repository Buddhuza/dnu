import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceCoverageRows } from './sourceCoverageRows.js';

test('source audit distinguishes included, checked, and unreviewed sites', () => {
  const sources = [
    { id: 'ap', name: 'AP', url: 'https://apnews.com/' },
    { id: 'bbc', name: 'BBC', url: 'https://bbc.com/' },
    { id: 'dw', name: 'DW', url: 'https://dw.com/' },
    { id: 'listing', name: 'Listing', url: 'https://example.org/' },
    { id: 'sampled', name: 'Sampled', url: 'https://example.net/' },
    { id: 'blocked', name: 'Blocked', url: 'https://example.com/' }
  ];
  const rows = sourceCoverageRows(sources, [{ sourceId: 'ap' }], [
    { id: 'bbc', status: 'no verified article', reason: 'Date unavailable on article page.' },
    { id: 'listing', status: 'listing-only', reason: 'Article pages were not reviewed.' },
    { id: 'sampled', status: 'sampled', reason: 'Two article pages were checked.' },
    { id: 'blocked', status: 'failed', reason: 'Firecrawl returned HTTP 403.' }
  ]);
  assert.deepEqual(rows.map(row => row.status), ['Included', 'Checked, no verified story', 'Not checked', 'Listing only', 'Article pages sampled', 'Fetch failed']);
  assert.match(rows[1].reason, /Date unavailable/);
  assert.match(rows[2].reason, /Not checked/);
  assert.match(rows[5].reason, /HTTP 403/);
});
