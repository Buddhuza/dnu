import test from 'node:test';
import assert from 'node:assert/strict';
import { estimatedRunSeconds, formatCountdown, progressEstimate } from './collectionProgress.js';

test('progress uses completed collection duration and caps an overdue running estimate', () => {
  const runs = [40, 80, 120].map(seconds => ({ status: 'completed', conclusion: 'success', created_at: '2026-11-16T10:00:00Z', updated_at: new Date(Date.parse('2026-11-16T10:00:00Z') + seconds * 1000).toISOString() }));
  assert.equal(estimatedRunSeconds(runs), 80);
  const start = Date.parse('2026-11-16T10:00:00Z');
  assert.deepEqual(progressEstimate({ state: 'running', startedAt: new Date(start).toISOString(), estimatedDurationSeconds: 80 }, start + 40_000), { percent: 50, remainingSeconds: 40, overrun: false });
  assert.deepEqual(progressEstimate({ state: 'running', startedAt: new Date(start).toISOString(), estimatedDurationSeconds: 80 }, start + 100_000), { percent: 95, remainingSeconds: 0, overrun: true });
  assert.equal(formatCountdown(125), '02:05');
});
