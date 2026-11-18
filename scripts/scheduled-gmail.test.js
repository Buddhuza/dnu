import test from 'node:test';
import assert from 'node:assert/strict';
import { isScheduledGmailCandidate, scheduledGmailUtcDate } from './scheduled-gmail.js';

test('00:35 Vienna uses the correct UTC schedule in winter and summer', () => {
  assert.equal(isScheduledGmailCandidate('35 23 * * *', new Date('2026-11-18T23:40:00Z')), true);
  assert.equal(isScheduledGmailCandidate('35 22 * * *', new Date('2026-11-18T22:40:00Z')), false);
  assert.equal(isScheduledGmailCandidate('35 22 * * *', new Date('2026-07-18T22:40:00Z')), true);
  assert.equal(isScheduledGmailCandidate('35 23 * * *', new Date('2026-07-18T23:40:00Z')), false);
  assert.equal(isScheduledGmailCandidate('45 23 * * *', new Date('2026-11-18T23:50:00Z')), true);
  assert.equal(isScheduledGmailCandidate('55 22 * * *', new Date('2026-07-18T23:00:00Z')), true);
  assert.equal(scheduledGmailUtcDate('55 23 * * *', new Date('2026-11-19T00:05:00Z')).toISOString(), '2026-11-18T23:55:00.000Z');
});
