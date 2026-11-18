import test from 'node:test';
import assert from 'node:assert/strict';
import { isScheduledGmailCandidate } from './scheduled-gmail.js';

test('21:30 Vienna uses the correct UTC schedule in winter and summer', () => {
  assert.equal(isScheduledGmailCandidate('30 20 * * *', new Date('2026-11-18T20:40:00Z')), true);
  assert.equal(isScheduledGmailCandidate('30 19 * * *', new Date('2026-11-18T19:40:00Z')), false);
  assert.equal(isScheduledGmailCandidate('30 19 * * *', new Date('2026-07-18T19:40:00Z')), true);
  assert.equal(isScheduledGmailCandidate('30 20 * * *', new Date('2026-07-18T20:40:00Z')), false);
  assert.equal(isScheduledGmailCandidate('30 19 * * *', new Date('2026-07-18T20:15:00Z')), true);
  assert.equal(isScheduledGmailCandidate('30 20 * * *', new Date('2026-07-18T20:15:00Z')), false);
});
