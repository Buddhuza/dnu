import test from 'node:test';
import assert from 'node:assert/strict';
import { completedNoticeMs, showScrapeNotice } from './scrapeNotice.js';

test('completed scrape notice expires and stays dismissed for the same run', () => {
  const now = Date.parse('2026-11-16T12:00:00Z');
  const status = { state: 'complete', runId: 42, updatedAt: new Date(now - 1000).toISOString() };
  assert.equal(showScrapeNotice(status, { now }), true);
  assert.equal(showScrapeNotice(status, { now, dismissedRunId: '42' }), false);
  assert.equal(showScrapeNotice(status, { now: now + completedNoticeMs }), false);
  assert.equal(showScrapeNotice({ ...status, runId: 43 }, { now, dismissedRunId: '42' }), true);
  assert.equal(showScrapeNotice({ state: 'running', runId: 43 }, { now }), true);
});
