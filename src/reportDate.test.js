import test from 'node:test';
import assert from 'node:assert/strict';
import { reportDateLabel } from './reportDate.js';

test('report date follows the Vienna coverage window', () => {
  assert.equal(reportDateLabel('2026-10-04T22:00:00Z', '2026-10-09T21:59:59Z'), '5–9 October 2026');
  assert.equal(reportDateLabel('2026-10-10T22:00:00Z', '2026-10-11T21:59:59Z'), '11 October 2026');
});
