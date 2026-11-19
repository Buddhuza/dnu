import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldSendScheduledGmail } from './should-send-scheduled-gmail.mjs';

const now = new Date('2026-11-19T13:00:00Z');
const base = { eventName: 'schedule', cron: '0 13 * * *', token: 'test-token', runId: 3, now };

test('manual sends bypass scheduled checks and wrong time-zone slots are skipped', async () => {
  const noFetch = () => { throw new Error('Unexpected GitHub request'); };
  assert.equal(await shouldSendScheduledGmail({ ...base, eventName: 'workflow_dispatch', fetchImpl: noFetch }), true);
  assert.equal(await shouldSendScheduledGmail({ ...base, cron: '0 12 * * *', fetchImpl: noFetch }), false);
});

test('backup slot skips after an earlier successful Gmail send step', async () => {
  const fetchImpl = async url => Response.json(String(url).endsWith('/jobs?per_page=30')
    ? { jobs: [{ steps: [{ name: 'Send from the situation room Gmail account', conclusion: 'success' }] }] }
    : { workflow_runs: [{ id: 2, event: 'schedule', conclusion: 'success', created_at: '2026-11-19T12:50:00Z' }] });
  assert.equal(await shouldSendScheduledGmail({ ...base, fetchImpl }), false);
});

test('backup sends if only the unused time-zone candidate completed', async () => {
  const fetchImpl = async url => Response.json(String(url).endsWith('/jobs?per_page=30')
    ? { jobs: [{ steps: [{ name: 'Send from the situation room Gmail account', conclusion: 'skipped' }] }] }
    : { workflow_runs: [{ id: 2, event: 'schedule', conclusion: 'success', created_at: '2026-11-19T11:50:00Z' }] });
  assert.equal(await shouldSendScheduledGmail({ ...base, fetchImpl }), true);
});

test('a delayed backup still checks the scheduled UTC date for an earlier delivery', async () => {
  const fetchImpl = async url => Response.json(String(url).endsWith('/jobs?per_page=30')
    ? { jobs: [{ steps: [{ name: 'Send from the situation room Gmail account', conclusion: 'success' }] }] }
    : { workflow_runs: [{ id: 2, event: 'schedule', conclusion: 'success', created_at: '2026-11-19T12:50:00Z' }] });
  assert.equal(await shouldSendScheduledGmail({ ...base, cron: '10 13 * * *', now: new Date('2026-11-19T13:15:00Z'), fetchImpl }), false);
});

test('a timed push can back up a missing schedule but skips an earlier send', async () => {
  const fetchImpl = async url => Response.json(String(url).endsWith('/jobs?per_page=30')
    ? { jobs: [{ steps: [{ name: 'Send from the situation room Gmail account', conclusion: 'success' }] }] }
    : { workflow_runs: [{ id: 2, event: 'schedule', conclusion: 'success', created_at: '2026-11-19T12:50:00Z' }] });
  assert.equal(await shouldSendScheduledGmail({ ...base, eventName: 'push', now: new Date('2026-11-19T12:55:30Z'), fetchImpl }), false);
  assert.equal(await shouldSendScheduledGmail({ ...base, eventName: 'push', now: new Date('2026-11-19T12:45:00Z'), fetchImpl }), false);
});

test('Supabase scheduled dispatch checks prior delivery while manual sends remain direct', async () => {
  const fetchImpl = async url => Response.json(String(url).endsWith('/jobs?per_page=30')
    ? { jobs: [{ steps: [{ name: 'Send from the situation room Gmail account', conclusion: 'success' }] }] }
    : { workflow_runs: [{ id: 2, event: 'workflow_dispatch', display_title: 'Send DNU auto-2026-11-19', conclusion: 'success', created_at: '2026-11-19T12:50:00Z' }] });
  assert.equal(await shouldSendScheduledGmail({ ...base, eventName: 'workflow_dispatch', scheduledDelivery: true, fetchImpl }), false);
  assert.equal(await shouldSendScheduledGmail({ ...base, eventName: 'workflow_dispatch', scheduledDelivery: false, fetchImpl }), true);
});

test('today’s earlier 13:30 send does not cancel the newly requested 13:50 send', async () => {
  const fetchImpl = async url => Response.json(String(url).endsWith('/jobs?per_page=30')
    ? { jobs: [{ steps: [{ name: 'Send from the situation room Gmail account', conclusion: 'success' }] }] }
    : { workflow_runs: [{ id: 2, event: 'workflow_dispatch', display_title: 'Send DNU auto-2026-11-19', conclusion: 'success', created_at: '2026-11-19T12:30:00Z' }] });
  assert.equal(await shouldSendScheduledGmail({ ...base, cron: '50 12 * * *', now: new Date('2026-11-19T12:50:00Z'), fetchImpl }), true);
});
