import test from 'node:test';
import assert from 'node:assert/strict';
import { dueCollectionSlot, isScheduledCollectionHour, isScheduledUtcCandidate, isStaleScheduledUtcCandidate } from './slots.js';

test('Vienna collection slots use local time across winter and summer offsets', () => {
  assert.equal(dueCollectionSlot(new Date('2026-01-10T00:00:00Z')), '2026-01-10T01:00 Europe/Vienna');
  assert.equal(dueCollectionSlot(new Date('2026-01-10T12:00:00Z')), '2026-01-10T13:00 Europe/Vienna');
  assert.equal(dueCollectionSlot(new Date('2026-06-01T23:00:00Z')), '2026-06-02T01:00 Europe/Vienna');
  assert.equal(dueCollectionSlot(new Date('2026-06-02T11:00:00Z')), '2026-06-02T13:00 Europe/Vienna');
  assert.equal(dueCollectionSlot(new Date('2026-06-02T11:14:00Z')), '2026-06-02T13:00 Europe/Vienna');
  assert.equal(dueCollectionSlot(new Date('2026-06-02T11:15:00Z')), null);
  assert.equal(dueCollectionSlot(new Date('2026-06-02T19:51:00Z')), null);
  assert.equal(dueCollectionSlot(new Date('2026-06-02T22:30:00Z')), null);
  assert.equal(isScheduledCollectionHour(new Date('2026-06-02T12:00:00Z')), false);
});

test('scheduled GitHub scrapes survive runner delays but not the next collection slot', () => {
  assert.equal(isScheduledUtcCandidate('0 23 * * *', new Date('2026-06-01T23:14:00Z')), true);
  assert.equal(isScheduledUtcCandidate('0 0 * * *', new Date('2026-06-02T00:05:00Z')), false);
  assert.equal(isScheduledUtcCandidate('0 11 * * *', new Date('2026-06-02T11:14:00Z')), true);
  assert.equal(isScheduledUtcCandidate('0 11 * * *', new Date('2026-06-02T11:15:00Z')), true);
  assert.equal(isScheduledUtcCandidate('0 12 * * *', new Date('2026-01-10T12:14:00Z')), true);
  assert.equal(isScheduledUtcCandidate('0 12 * * *', new Date('2026-01-10T19:51:00Z')), true);
  assert.equal(isScheduledUtcCandidate('0 0 * * *', new Date('2026-11-20T05:56:00Z')), true);
  assert.equal(isScheduledUtcCandidate('0 0 * * *', new Date('2026-11-20T12:00:00Z')), false);
  assert.equal(isStaleScheduledUtcCandidate('0 0 * * *', new Date('2026-11-20T12:00:00Z')), true);
  assert.equal(isStaleScheduledUtcCandidate('0 23 * * *', new Date('2026-11-20T05:56:00Z')), false);
  assert.equal(isScheduledUtcCandidate('0 23 * * *', new Date('2026-01-10T23:15:00Z')), false);
});
