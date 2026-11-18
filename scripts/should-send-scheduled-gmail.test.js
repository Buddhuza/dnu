import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldSendScheduledGmail } from './should-send-scheduled-gmail.mjs';

const now = new Date('2026-11-18T23:45:00Z');
const base = { eventName: 'schedule', cron: '45 23 * * *', token: 'test-token', runId: 3, now };

test('manual sends bypass scheduled checks and wrong time-zone slots are skipped', async () => {
  const noFetch = () => { throw new Error('Unexpected GitHub request'); };
  assert.equal(await shouldSendScheduledGmail({ ...base, eventName: 'workflow_dispatch', fetchImpl: noFetch }), true);
  assert.equal(await shouldSendScheduledGmail({ ...base, cron: '45 22 * * *', fetchImpl: noFetch }), false);
});

test('backup slot skips after an earlier successful Gmail send step', async () => {
  const fetchImpl = async url => Response.json(String(url).endsWith('/jobs?per_page=30')
    ? { jobs: [{ steps: [{ name: 'Send from the situation room Gmail account', conclusion: 'success' }] }] }
    : { workflow_runs: [{ id: 2, event: 'schedule', conclusion: 'success', created_at: '2026-11-18T23:35:00Z' }] });
  assert.equal(await shouldSendScheduledGmail({ ...base, fetchImpl }), false);
});

test('backup sends if only the unused time-zone candidate completed', async () => {
  const fetchImpl = async url => Response.json(String(url).endsWith('/jobs?per_page=30')
    ? { jobs: [{ steps: [{ name: 'Send from the situation room Gmail account', conclusion: 'skipped' }] }] }
    : { workflow_runs: [{ id: 2, event: 'schedule', conclusion: 'success', created_at: '2026-11-18T22:35:00Z' }] });
  assert.equal(await shouldSendScheduledGmail({ ...base, fetchImpl }), true);
});

test('a delayed backup still checks the previous UTC day for an earlier delivery', async () => {
  const fetchImpl = async url => Response.json(String(url).endsWith('/jobs?per_page=30')
    ? { jobs: [{ steps: [{ name: 'Send from the situation room Gmail account', conclusion: 'success' }] }] }
    : { workflow_runs: [{ id: 2, event: 'schedule', conclusion: 'success', created_at: '2026-11-18T23:35:00Z' }] });
  assert.equal(await shouldSendScheduledGmail({ ...base, cron: '55 23 * * *', now: new Date('2026-11-19T00:05:00Z'), fetchImpl }), false);
});

test('a timed push can back up a missing schedule but skips an earlier send', async () => {
  const fetchImpl = async url => Response.json(String(url).endsWith('/jobs?per_page=30')
    ? { jobs: [{ steps: [{ name: 'Send from the situation room Gmail account', conclusion: 'success' }] }] }
    : { workflow_runs: [{ id: 2, event: 'schedule', conclusion: 'success', created_at: '2026-11-18T23:35:00Z' }] });
  assert.equal(await shouldSendScheduledGmail({ ...base, eventName: 'push', now: new Date('2026-11-18T23:35:30Z'), fetchImpl }), false);
  assert.equal(await shouldSendScheduledGmail({ ...base, eventName: 'push', now: new Date('2026-11-18T23:30:00Z'), fetchImpl }), false);
});

test('Supabase scheduled dispatch checks prior delivery while manual sends remain direct', async () => {
  const fetchImpl = async url => Response.json(String(url).endsWith('/jobs?per_page=30')
    ? { jobs: [{ steps: [{ name: 'Send from the situation room Gmail account', conclusion: 'success' }] }] }
    : { workflow_runs: [{ id: 2, event: 'workflow_dispatch', display_title: 'Send DNU auto-2026-11-19', conclusion: 'success', created_at: '2026-11-18T23:35:00Z' }] });
  assert.equal(await shouldSendScheduledGmail({ ...base, eventName: 'workflow_dispatch', scheduledDelivery: true, fetchImpl }), false);
  assert.equal(await shouldSendScheduledGmail({ ...base, eventName: 'workflow_dispatch', scheduledDelivery: false, fetchImpl }), true);
});
