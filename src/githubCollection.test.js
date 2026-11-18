import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchGithubDraft, fetchGithubDraftStatus, githubCollectionStatus, startGithubCollection } from './githubCollection.js';

test('GitHub collection status distinguishes running and completed draft runs', async () => {
  const respond = run => async url => ({ ok: true, json: async () => String(url).includes('native-draft-status.json') ? { runId: run.id } : { workflow_runs: [run] } });
  assert.equal((await githubCollectionStatus(respond({ status: 'in_progress', updated_at: '2026-11-10T13:00:00Z' }))).state, 'running');
  assert.equal((await githubCollectionStatus(respond({ id: 42, status: 'completed', conclusion: 'success', updated_at: '2026-11-10T13:05:00Z' }))).state, 'complete');
});

test('the editor loads a completed GitHub JSON draft', async () => {
  const draft = { checkedAt: '2026-11-10T13:00:00Z', articles: [{ id: 'story' }] };
  assert.deepEqual(await fetchGithubDraft(async () => ({ ok: true, json: async () => draft })), draft);
  await assert.rejects(fetchGithubDraft(async () => ({ ok: false })), /No completed review draft/);
});

test('latest scrape metadata supplies its finish time and story count', async () => {
  const draft = { runId: 42, checkedAt: '2026-11-16T13:00:00Z', finishedAt: '2026-11-16T13:08:00Z', stories: 81, trigger: 'automatic' };
  assert.deepEqual(await fetchGithubDraftStatus(async () => ({ ok: true, json: async () => draft })), draft);
  assert.equal(await fetchGithubDraftStatus(async () => ({ ok: false })), null);
});

test('latest completed scrape retains manual or automatic origin', async () => {
  for (const [event, trigger] of [['workflow_dispatch', 'manual'], ['schedule', 'automatic']]) {
    const fetchImpl = async url => ({ ok: true, json: async () => String(url).includes('native-draft-status.json')
      ? { runId: 42, checkedAt: '2026-11-16T13:00:00Z', stories: 81, trigger }
      : { workflow_runs: [{ id: 42, event, status: 'completed', conclusion: 'success', updated_at: '2026-11-16T13:08:00Z' }] } });
    assert.equal((await githubCollectionStatus(fetchImpl)).trigger, trigger);
  }
});

test('a skipped daylight-saving candidate keeps the previous completed draft available', async () => {
  const fetchImpl = async url => ({ ok: true, json: async () => String(url).includes('native-draft-status.json')
    ? { runId: 41, checkedAt: '2026-11-10T13:00:00Z', stories: 39, runUrl: 'https://github.com/example/runs/41' }
    : { workflow_runs: [{ id: 42, event: 'schedule', status: 'completed', conclusion: 'success', updated_at: '2026-11-10T14:00:00Z' }] } });
  const status = await githubCollectionStatus(fetchImpl);
  assert.equal(status.state, 'complete');
  assert.match(status.message, /39 stories/);
});

test('one-click collection uses the signed-in editor function', async () => {
  let invoked = '';
  const client = {
    auth: { getSession: async () => ({ data: { session: { access_token: 'editor-session' } } }) },
    functions: { invoke: async name => { invoked = name; return { data: { started: true } }; } }
  };
  assert.deepEqual(await startGithubCollection(client), { started: true });
  assert.equal(invoked, 'start-dnu-collection');
  await assert.rejects(startGithubCollection({ auth: { getSession: async () => ({ data: { session: null } }) } }), /Sign in/);
});

test('the editor sees a useful error without backend details when the trigger is unavailable', async () => {
  const client = {
    auth: { getSession: async () => ({ data: { session: { access_token: 'editor-session' } } }) },
    functions: { invoke: async () => ({ error: { context: { json: async () => ({ error: 'Missing GitHub workflow token.' }) } } }) }
  };
  await assert.rejects(startGithubCollection(client), /Could not start scraping/);
});

test('the scrape status describes article collection progress without backend names', async () => {
  const status = await githubCollectionStatus(async url => ({ ok: true, json: async () => String(url).includes('/jobs')
    ? { jobs: [{ steps: [{ name: 'Collect completed JSON from publishers', status: 'in_progress' }] }] }
    : { workflow_runs: [{ id: 42, status: 'in_progress', jobs_url: 'https://api.github.com/jobs', created_at: '2026-11-16T10:00:00Z' }] } }));
  assert.equal(status.message, 'Checking source websites and extracting articles…');
  assert.equal(status.createdAt, '2026-11-16T10:00:00Z');
});
