import test from 'node:test';
import assert from 'node:assert/strict';
import { gmailDeliveryStatus, waitForGmailDelivery } from './gmailDelivery.js';

test('delivery status follows only the matching send request', async () => {
  const fetchImpl = async () => Response.json({ workflow_runs: [
    { display_title: 'Send DNU someone-else', status: 'completed', conclusion: 'failure' },
    { display_title: 'Send DNU request-1', status: 'completed', conclusion: 'success' }
  ] });
  assert.equal(await gmailDeliveryStatus('request-1', fetchImpl), 'sent');
  assert.equal(await waitForGmailDelivery('request-1', { fetchImpl, pause: async () => {}, attempts: 1 }), 'sent');
});
