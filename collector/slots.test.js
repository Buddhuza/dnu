import test from 'node:test';
import assert from 'node:assert/strict';
import { dueCollectionSlot, isScheduledCollectionHour, isScheduledUtcCandidate } from './slots.js';

test('Vienna collection slots use local time across winter and summer offsets', () => {
  assert.equal(dueCollectionSlot(new Date('2026-01-10T00:00:00Z')), '2026-01-10T01:00 Europe/Vienna');
  assert.equal(dueCollectionSlot(new Date('2026-01-10T12:00:00Z')), '2026-01-10T13:00 Europe/Vienna');
  assert.equal(dueCollectionSlot(new Date('2026-06-01T23:00:00Z')), '2026-06-02T01:00 Europe/Vienna');
  assert.equal(dueCollectionSlot(new Date('2026-06-02T11:00:00Z')), '2026-06-02T13:00 Europe/Vienna');
  assert.equal(dueCollectionSlot(new Date('2026-06-02T22:30:00Z')), null);
  assert.equal(isScheduledCollectionHour(new Date('2026-06-02T12:00:00Z')), false);
});

test('delayed GitHub runs use their scheduled UTC hour for the Vienna gate', () => {
  assert.equal(isScheduledUtcCandidate('0 23 * * *', new Date('2026-06-02T00:30:00Z')), true);
  assert.equal(isScheduledUtcCandidate('0 0 * * *', new Date('2026-06-02T01:30:00Z')), false);
  assert.equal(isScheduledUtcCandidate('0 11 * * *', new Date('2026-06-02T12:15:00Z')), true);
  assert.equal(isScheduledUtcCandidate('0 12 * * *', new Date('2026-01-10T13:15:00Z')), true);
  assert.equal(isScheduledUtcCandidate('0 23 * * *', new Date('2026-01-10T23:15:00Z')), false);
});
