import test from 'node:test';
import assert from 'node:assert/strict';
import { collectionDecision, dueCollectionSlot, isScheduledCollectionHour, isScheduledUtcCandidate, isStaleScheduledUtcCandidate, mostRecentViennaSlot } from './slots.js';

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

test('hourly recovery runs only for a missing Vienna slot', () => {
  const winter = new Date('2026-11-20T05:56:00Z');
  const slot = '2026-11-20T01:00 Europe/Vienna';
  assert.equal(mostRecentViennaSlot(winter), slot);
  assert.deepEqual(collectionDecision('schedule', '15 * * * *', '', winter),
    { run: true, scheduledSlot: slot, recordSkip: false });
  assert.deepEqual(collectionDecision('schedule', '15 * * * *', slot, winter),
    { run: false, scheduledSlot: '', recordSkip: false });
  assert.deepEqual(collectionDecision('schedule', '0 0 * * *', slot, winter),
    { run: false, scheduledSlot: '', recordSkip: false });
  assert.deepEqual(collectionDecision('schedule', '0 23 * * *', '', winter),
    { run: false, scheduledSlot: '', recordSkip: false });
  assert.equal(mostRecentViennaSlot(new Date('2026-11-20T00:00:00Z')), slot);
  assert.equal(mostRecentViennaSlot(new Date('2026-11-19T23:30:00Z')), '2026-11-19T13:00 Europe/Vienna');
});

test('recovery follows summer time and a delayed primary cannot duplicate the completed slot', () => {
  const summerSlot = '2026-06-02T13:00 Europe/Vienna';
  assert.equal(mostRecentViennaSlot(new Date('2026-06-02T17:15:00Z')), summerSlot);
  assert.equal(collectionDecision('schedule', '15 * * * *', summerSlot, new Date('2026-06-02T17:15:00Z')).run, false);
  assert.equal(collectionDecision('schedule', '0 11 * * *', '', new Date('2026-06-02T17:15:00Z')).scheduledSlot, summerSlot);
  assert.deepEqual(collectionDecision('push', '', '', new Date('2026-11-20T09:42:00Z')),
    { run: true, scheduledSlot: '', recordSkip: false });
  assert.equal(collectionDecision('workflow_dispatch', '', '', new Date('2026-11-20T09:42:00Z'), true).scheduledSlot, '2026-11-20T01:00 Europe/Vienna');
  assert.equal(collectionDecision('workflow_dispatch', '', '2026-11-20T01:00 Europe/Vienna', new Date('2026-11-20T09:42:00Z'), true).run, false);
  assert.equal(collectionDecision('workflow_dispatch', '', '2026-11-20T01:00 Europe/Vienna', new Date('2026-11-20T09:42:00Z')).run, true);
});
