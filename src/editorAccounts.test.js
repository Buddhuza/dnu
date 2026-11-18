import test from 'node:test';
import assert from 'node:assert/strict';
import { accountForUsername, usernameForEmail } from './editorAccounts.js';

test('named editors sign in with usernames while owner keeps the existing Auth account', () => {
  assert.equal(accountForUsername(' LKHUBULAVA ').email, 'buddhuza@gmail.com');
  for (const username of ['gjordan', 'vnikolov', 'vjosifovic', 'mristevski']) {
    const account = accountForUsername(username);
    assert.equal(account.role, 'editor');
    assert.equal(usernameForEmail(account.email), username);
  }
  assert.equal(accountForUsername('unknown'), null);
});
