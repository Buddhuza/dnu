import test from 'node:test';
import assert from 'node:assert/strict';
import { isScheduledGmailCandidate, scheduledGmailUtcDate } from './scheduled-gmail.js';

test('13:50 Vienna uses the correct UTC schedule in winter and summer', () => {
  assert.equal(isScheduledGmailCandidate('50 12 * * *', new Date('2026-11-19T12:55:00Z')), true);
  assert.equal(isScheduledGmailCandidate('50 11 * * *', new Date('2026-11-19T11:55:00Z')), false);
  assert.equal(isScheduledGmailCandidate('50 11 * * *', new Date('2026-07-18T11:55:00Z')), true);
  assert.equal(isScheduledGmailCandidate('50 12 * * *', new Date('2026-07-18T12:55:00Z')), false);
  assert.equal(isScheduledGmailCandidate('0 13 * * *', new Date('2026-11-19T13:05:00Z')), true);
  assert.equal(isScheduledGmailCandidate('10 12 * * *', new Date('2026-07-18T12:15:00Z')), true);
  assert.equal(scheduledGmailUtcDate('10 13 * * *', new Date('2026-11-19T13:15:00Z')).toISOString(), '2026-11-19T13:10:00.000Z');
});
