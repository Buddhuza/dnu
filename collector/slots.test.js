import test from 'node:test';
import assert from 'node:assert/strict';
import { collectionDecision, dueCollectionSlot, isScheduledCollectionHour, isScheduledUtcCandidate, isStaleScheduledUtcCandidate, mostRecentViennaSlot } from './slots.js';

test('07:00 and 19:00 Vienna collection slots follow winter and summer offsets', () => {
  assert.equal(dueCollectionSlot(new Date('2026-01-10T06:00:00Z')), '2026-01-10T07:00 Europe/Vienna');
  assert.equal(dueCollectionSlot(new Date('2026-01-10T18:00:00Z')), '2026-01-10T19:00 Europe/Vienna');
  assert.equal(dueCollectionSlot(new Date('2026-06-02T05:00:00Z')), '2026-06-02T07:00 Europe/Vienna');
  assert.equal(dueCollectionSlot(new Date('2026-06-02T17:00:00Z')), '2026-06-02T19:00 Europe/Vienna');
  assert.equal(dueCollectionSlot(new Date('2026-06-02T17:14:00Z')), '2026-06-02T19:00 Europe/Vienna');
  assert.equal(dueCollectionSlot(new Date('2026-06-02T17:15:00Z')), null);
  assert.equal(dueCollectionSlot(new Date('2026-06-02T11:00:00Z')), null);
  assert.equal(isScheduledCollectionHour(new Date('2026-06-02T12:00:00Z')), false);
});

test('scheduled GitHub scrapes survive runner delays but not the next collection slot', () => {
  assert.equal(isScheduledUtcCandidate('0 5 * * *', new Date('2026-06-02T05:14:00Z')), true);
  assert.equal(isScheduledUtcCandidate('0 6 * * *', new Date('2026-06-02T06:05:00Z')), false);
  assert.equal(isScheduledUtcCandidate('0 17 * * *', new Date('2026-06-02T17:15:00Z')), true);
  assert.equal(isScheduledUtcCandidate('0 18 * * *', new Date('2026-01-10T18:14:00Z')), true);
  assert.equal(isScheduledUtcCandidate('0 6 * * *', new Date('2026-11-20T11:56:00Z')), true);
  assert.equal(isScheduledUtcCandidate('0 6 * * *', new Date('2026-11-20T18:00:00Z')), false);
  assert.equal(isStaleScheduledUtcCandidate('0 6 * * *', new Date('2026-11-20T18:00:00Z')), true);
  assert.equal(isStaleScheduledUtcCandidate('0 5 * * *', new Date('2026-06-02T11:56:00Z')), false);
  assert.equal(isScheduledUtcCandidate('0 5 * * *', new Date('2026-01-10T23:15:00Z')), false);
});

test('hourly recovery runs only for a missing Vienna slot', () => {
  const winter = new Date('2026-11-20T08:56:00Z');
  const slot = '2026-11-20T07:00 Europe/Vienna';
  assert.equal(mostRecentViennaSlot(winter), slot);
  assert.deepEqual(collectionDecision('schedule', '15 * * * *', '', winter),
    { run: true, scheduledSlot: slot, recordSkip: false });
  assert.deepEqual(collectionDecision('schedule', '15 * * * *', slot, winter),
    { run: false, scheduledSlot: '', recordSkip: false });
  assert.deepEqual(collectionDecision('schedule', '0 6 * * *', slot, winter),
    { run: false, scheduledSlot: '', recordSkip: false });
  assert.deepEqual(collectionDecision('schedule', '0 5 * * *', '', winter),
    { run: false, scheduledSlot: '', recordSkip: false });
  assert.equal(mostRecentViennaSlot(new Date('2026-11-20T06:00:00Z')), slot);
  assert.equal(mostRecentViennaSlot(new Date('2026-11-19T23:30:00Z')), '2026-11-19T19:00 Europe/Vienna');
});

test('recovery follows summer time and a delayed primary cannot duplicate the completed slot', () => {
  const summerSlot = '2026-06-02T19:00 Europe/Vienna';
  assert.equal(mostRecentViennaSlot(new Date('2026-06-02T20:15:00Z')), summerSlot);
  assert.equal(collectionDecision('schedule', '15 * * * *', summerSlot, new Date('2026-06-02T20:15:00Z')).run, false);
  assert.equal(collectionDecision('schedule', '0 17 * * *', '', new Date('2026-06-02T20:15:00Z')).scheduledSlot, summerSlot);
  assert.deepEqual(collectionDecision('push', '', '', new Date('2026-11-20T09:42:00Z')),
    { run: true, scheduledSlot: '', recordSkip: false });
  assert.equal(collectionDecision('workflow_dispatch', '', '', new Date('2026-11-20T09:42:00Z'), true).scheduledSlot, '2026-11-20T07:00 Europe/Vienna');
  assert.equal(collectionDecision('workflow_dispatch', '', '2026-11-20T07:00 Europe/Vienna', new Date('2026-11-20T09:42:00Z'), true).run, false);
  assert.equal(collectionDecision('workflow_dispatch', '', '2026-11-20T07:00 Europe/Vienna', new Date('2026-11-20T09:42:00Z')).run, true);
});
