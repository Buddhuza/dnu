import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGmailRecipients, normalizedGmailRecipients } from './gmailRecipients.js';

test('recipient list accepts lines, removes duplicates, and rejects invalid addresses', () => {
  assert.deepEqual(parseGmailRecipients('One@example.com\ntwo@example.com;one@example.com'), ['one@example.com', 'two@example.com']);
  assert.throws(() => parseGmailRecipients(''), /at least one/);
  assert.throws(() => parseGmailRecipients('name@example.com\nnot-an-address'), /valid email/);
  assert.deepEqual(normalizedGmailRecipients(undefined), ['buddhuza@gmail.com', 'ayabushady@gmail.com']);
});
