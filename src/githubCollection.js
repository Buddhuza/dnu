export const githubCollectionWorkflow = 'https://github.com/Buddhuza/dnu/actions/workflows/test-daily-collection.yml';
const githubRunsApi = 'https://api.github.com/repos/Buddhuza/dnu/actions/workflows/test-daily-collection.yml/runs?branch=main&per_page=1';

function pagesFile(name) {
  return `${import.meta.env?.BASE_URL || '/'}${name}`;
}

export async function fetchGithubDraft(fetchImpl = fetch) {
  const response = await fetchImpl(pagesFile('native-draft.json'), { cache: 'no-store' });
  if (!response.ok) throw new Error('No completed GitHub draft is available yet.');
  const draft = await response.json();
  if (!Array.isArray(draft.articles) || !draft.checkedAt) throw new Error('The GitHub draft is incomplete.');
  return draft;
}

export async function startGithubCollection(client) {
  if (!client) throw new Error('Sign in as the editor first.');
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) throw new Error('Sign in as the editor first.');
  const { data, error } = await client.functions.invoke('start-dnu-collection', { method: 'POST', body: {} });
  if (error) {
    let message = data?.error;
    try { message ||= (await error.context?.json())?.error; } catch { /* Network errors have no JSON body. */ }
    throw new Error(message || 'Could not start the GitHub scraper. Check the Supabase function setup.');
  }
  if (!data?.started) throw new Error(data?.error || 'GitHub did not confirm the collection request.');
  return data;
}

export async function githubCollectionStatus(fetchImpl = fetch) {
  try {
    const response = await fetchImpl(githubRunsApi, { cache: 'no-store', headers: { Accept: 'application/vnd.github+json' } });
    if (!response.ok) throw new Error(`GitHub status HTTP ${response.status}`);
    const run = (await response.json()).workflow_runs?.[0];
    if (run) {
      const state = run.status === 'completed' ? run.conclusion === 'success' ? 'complete' : 'failed' : 'running';
      if (state === 'complete') {
        const published = await fetchImpl(pagesFile('native-draft-status.json'), { cache: 'no-store' });
        const draft = published.ok ? await published.json() : null;
        if (draft && run.event === 'schedule' && Number(draft.runId) !== Number(run.id)) return {
          state: 'complete', runId: Number(draft.runId), checkedAt: draft.checkedAt, updatedAt: draft.checkedAt, runUrl: draft.runUrl,
          message: `Latest completed GitHub draft: ${draft.stories} stories. A scheduled UTC check did not replace it.`
        };
        if (!draft || Number(draft.runId) !== Number(run.id)) return {
          state: 'running', runId: run.id, updatedAt: run.updated_at, runUrl: run.html_url,
          message: 'GitHub finished scraping; the review draft is being placed on the website…'
        };
      }
      return {
        state, runId: run.id, checkedAt: run.updated_at, updatedAt: run.updated_at, runUrl: run.html_url,
        message: state === 'running' ? 'GitHub is collecting the news draft…' : state === 'complete' ? 'GitHub collection finished. Load the latest draft for review.' : 'The latest GitHub collection failed. Open its run for details.'
      };
    }
  } catch { /* A completed Pages draft remains available if GitHub's API is rate limited. */ }
  try {
    const response = await fetchImpl(pagesFile('native-draft-status.json'), { cache: 'no-store' });
    if (response.ok) {
      const status = await response.json();
      return { state: 'complete', runId: Number(status.runId), checkedAt: status.checkedAt, updatedAt: status.checkedAt, message: `Latest completed GitHub draft: ${status.stories} stories.`, runUrl: status.runUrl };
    }
  } catch { /* The first run may not have produced a draft yet. */ }
  return { state: 'idle', message: 'Run the GitHub collection workflow to create a draft.' };
}
