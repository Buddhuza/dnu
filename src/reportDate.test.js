import test from 'node:test';
import assert from 'node:assert/strict';
import { reportDateLabel, reportEndDateLabel, reportShortDateLabel } from './reportDate.js';

test('report date follows the Vienna coverage window', () => {
  assert.equal(reportDateLabel('2026-10-04T22:00:00Z', '2026-10-09T21:59:59Z'), '5–9 October 2026');
  assert.equal(reportDateLabel('2026-10-10T22:00:00Z', '2026-10-11T21:59:59Z'), '11 October 2026');
});

test('update heading uses the last day in Vienna, not the coverage range', () => {
  assert.equal(reportEndDateLabel('2026-10-14T22:10:00Z'), '15 October 2026');
  assert.equal(reportEndDateLabel('2026-10-09T21:59:59Z'), '9 October 2026');
});

test('website update date uses abbreviated month and two-digit year', () => {
  assert.equal(reportShortDateLabel('2026-10-14T22:10:00Z'), '15 Oct 26');
  assert.equal(reportShortDateLabel('2026-10-14T12:00:00Z'), '14 Oct 26');
});
