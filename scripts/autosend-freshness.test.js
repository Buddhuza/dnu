import test from 'node:test';
import assert from 'node:assert/strict';
import { needsAutosendScrape } from './autosend-freshness.mjs';

const draft = { nativeEdition: true, checkedAt: '2026-11-20T23:05:00Z', articles: [{ id: 'one' }] };
const status = { checkedAt: draft.checkedAt, stories: 1, runId: 123 };

test('AUTOSEND uses a scrape from the same Vienna day, even just after midnight', () => {
  assert.equal(needsAutosendScrape(draft, status, new Date('2026-11-21T06:00:00Z')), false);
});

test('AUTOSEND scrapes when the latest draft is from the previous Vienna day', () => {
  assert.equal(needsAutosendScrape(draft, status, new Date('2026-11-21T23:05:00Z')), true);
});

test('AUTOSEND scrapes if the saved edition and status do not match', () => {
  assert.equal(needsAutosendScrape(draft, { ...status, stories: 2 }, new Date('2026-11-21T06:00:00Z')), true);
  assert.equal(needsAutosendScrape(null, null, new Date('2026-11-21T06:00:00Z')), true);
});
