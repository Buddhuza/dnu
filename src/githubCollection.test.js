import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchGithubDraft, githubCollectionStatus } from './githubCollection.js';

test('GitHub collection status distinguishes running and completed draft runs', async () => {
  const respond = run => async url => ({ ok: true, json: async () => String(url).includes('native-draft-status.json') ? { runId: run.id } : { workflow_runs: [run] } });
  assert.equal((await githubCollectionStatus(respond({ status: 'in_progress', updated_at: '2026-11-10T13:00:00Z' }))).state, 'running');
  assert.equal((await githubCollectionStatus(respond({ id: 42, status: 'completed', conclusion: 'success', updated_at: '2026-11-10T13:05:00Z' }))).state, 'complete');
});

test('the editor loads a completed GitHub JSON draft', async () => {
  const draft = { checkedAt: '2026-11-10T13:00:00Z', articles: [{ id: 'story' }] };
  assert.deepEqual(await fetchGithubDraft(async () => ({ ok: true, json: async () => draft })), draft);
  await assert.rejects(fetchGithubDraft(async () => ({ ok: false })), /No completed GitHub draft/);
});

test('a skipped daylight-saving candidate keeps the previous completed draft available', async () => {
  const fetchImpl = async url => ({ ok: true, json: async () => String(url).includes('native-draft-status.json')
    ? { runId: 41, checkedAt: '2026-11-10T13:00:00Z', stories: 39, runUrl: 'https://github.com/example/runs/41' }
    : { workflow_runs: [{ id: 42, event: 'schedule', status: 'completed', conclusion: 'success', updated_at: '2026-11-10T14:00:00Z' }] } });
  const status = await githubCollectionStatus(fetchImpl);
  assert.equal(status.state, 'complete');
  assert.match(status.message, /39 stories/);
});
