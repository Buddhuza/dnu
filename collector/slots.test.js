import test from 'node:test';
import assert from 'node:assert/strict';
import { dueCollectionSlot, isScheduledCollectionHour } from './slots.js';

test('Vienna collection slots use local time across winter and summer offsets', () => {
  assert.equal(dueCollectionSlot(new Date('2026-01-10T00:00:00Z')), '2026-01-10T01:00 Europe/Vienna');
  assert.equal(dueCollectionSlot(new Date('2026-01-10T12:00:00Z')), '2026-01-10T13:00 Europe/Vienna');
  assert.equal(dueCollectionSlot(new Date('2026-06-01T23:00:00Z')), '2026-06-02T01:00 Europe/Vienna');
  assert.equal(dueCollectionSlot(new Date('2026-06-02T11:00:00Z')), '2026-06-02T13:00 Europe/Vienna');
  assert.equal(dueCollectionSlot(new Date('2026-06-02T22:30:00Z')), null);
  assert.equal(isScheduledCollectionHour(new Date('2026-06-02T12:00:00Z')), false);
});
