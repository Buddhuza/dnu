import test from 'node:test';
import assert from 'node:assert/strict';
import { isScheduledGmailCandidate, scheduledGmailUtcDate } from './scheduled-gmail.js';

test('13:30 Vienna uses the correct UTC schedule in winter and summer', () => {
  assert.equal(isScheduledGmailCandidate('30 12 * * *', new Date('2026-11-19T12:35:00Z')), true);
  assert.equal(isScheduledGmailCandidate('30 11 * * *', new Date('2026-11-19T11:35:00Z')), false);
  assert.equal(isScheduledGmailCandidate('30 11 * * *', new Date('2026-07-18T11:35:00Z')), true);
  assert.equal(isScheduledGmailCandidate('30 12 * * *', new Date('2026-07-18T12:35:00Z')), false);
  assert.equal(isScheduledGmailCandidate('40 12 * * *', new Date('2026-11-19T12:45:00Z')), true);
  assert.equal(isScheduledGmailCandidate('50 11 * * *', new Date('2026-07-18T11:55:00Z')), true);
  assert.equal(scheduledGmailUtcDate('50 12 * * *', new Date('2026-11-19T13:05:00Z')).toISOString(), '2026-11-19T12:50:00.000Z');
});
