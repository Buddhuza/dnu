import test from 'node:test';
import assert from 'node:assert/strict';
import { isScheduledGmailCandidate, scheduledGmailUtcDate } from './scheduled-gmail.js';

test('16:00 Vienna uses the correct UTC schedule in winter and summer', () => {
  assert.equal(isScheduledGmailCandidate('0 15 * * *', new Date('2026-11-19T15:05:00Z')), true);
  assert.equal(isScheduledGmailCandidate('0 14 * * *', new Date('2026-11-19T14:05:00Z')), false);
  assert.equal(isScheduledGmailCandidate('0 14 * * *', new Date('2026-07-18T14:05:00Z')), true);
  assert.equal(isScheduledGmailCandidate('0 15 * * *', new Date('2026-07-18T15:05:00Z')), false);
  assert.equal(isScheduledGmailCandidate('10 15 * * *', new Date('2026-11-19T15:15:00Z')), true);
  assert.equal(isScheduledGmailCandidate('20 14 * * *', new Date('2026-07-18T14:25:00Z')), true);
  assert.equal(scheduledGmailUtcDate('20 15 * * *', new Date('2026-11-19T15:25:00Z')).toISOString(), '2026-11-19T15:20:00.000Z');
});
