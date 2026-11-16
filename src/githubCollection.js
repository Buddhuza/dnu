const githubRunsApi = 'https://api.github.com/repos/Buddhuza/dnu/actions/workflows/test-daily-collection.yml/runs?branch=main&per_page=1';

function userFacingError(message) {
  if (/github|supabase|workflow|function/i.test(message)) return 'Could not start scraping. Please check the scraper setup and try again.';
  return message;
}

async function runningMessage(run, fetchImpl) {
  if (run.status === 'queued' || run.status === 'waiting') return 'Scrape is queued…';
  if (!run.jobs_url) return 'Checking source websites and articles…';
  try {
    const response = await fetchImpl(run.jobs_url, { cache: 'no-store', headers: { Accept: 'application/vnd.github+json' } });
    if (!response.ok) return 'Checking source websites and articles…';
    const steps = (await response.json()).jobs?.flatMap(job => job.steps || []) || [];
    const active = steps.find(step => step.status === 'in_progress')?.name || '';
    if (/collect completed json/i.test(active)) return 'Checking source websites and extracting articles…';
    if (/save draft|make completed draft/i.test(active)) return 'Preparing the completed draft…';
    if (active) return 'Preparing the scrape…';
  } catch { /* Step details may be temporarily unavailable. */ }
  return 'Checking source websites and articles…';
}

function pagesFile(name) {
  return `${import.meta.env?.BASE_URL || '/'}${name}`;
}

export async function fetchGithubDraft(fetchImpl = fetch) {
  const response = await fetchImpl(pagesFile('native-draft.json'), { cache: 'no-store' });
  if (!response.ok) throw new Error('No completed review draft is available yet.');
  const draft = await response.json();
  if (!Array.isArray(draft.articles) || !draft.checkedAt) throw new Error('The review draft is incomplete.');
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
    throw new Error(userFacingError(message || 'Could not start scraping. Please check the scraper setup and try again.'));
  }
  if (!data?.started) throw new Error(userFacingError(data?.error || 'The scrape request was not confirmed.'));
  return data;
}

export async function githubCollectionStatus(fetchImpl = fetch) {
  try {
    const response = await fetchImpl(githubRunsApi, { cache: 'no-store', headers: { Accept: 'application/vnd.github+json' } });
    if (!response.ok) throw new Error(`GitHub status HTTP ${response.status}`);
    const runs = (await response.json()).workflow_runs || [];
    const run = runs[0];
    if (run) {
      const state = run.status === 'completed' ? run.conclusion === 'success' ? 'complete' : 'failed' : 'running';
      if (state === 'complete') {
        const published = await fetchImpl(pagesFile('native-draft-status.json'), { cache: 'no-store' });
        const draft = published.ok ? await published.json() : null;
        if (draft && run.event === 'schedule' && Number(draft.runId) !== Number(run.id)) return {
          state: 'complete', runId: Number(draft.runId), checkedAt: draft.checkedAt, createdAt: draft.checkedAt, updatedAt: draft.checkedAt, runUrl: draft.runUrl,
          message: `Latest completed draft: ${draft.stories} stories.`
        };
        if (!draft || Number(draft.runId) !== Number(run.id)) return {
          state: 'running', runId: run.id, createdAt: run.created_at, startedAt: run.run_started_at || run.created_at, updatedAt: run.updated_at, runUrl: run.html_url,
          message: 'Scraping finished; preparing the completed draft…'
        };
      }
      return {
        state, runId: run.id, checkedAt: run.updated_at, createdAt: run.created_at, startedAt: run.run_started_at || run.created_at, updatedAt: run.updated_at, runUrl: run.html_url,
        message: state === 'running' ? await runningMessage(run, fetchImpl) : state === 'complete' ? 'Scrape complete. The draft is ready to publish.' : 'The latest scrape failed. Please try again.'
      };
    }
  } catch { /* A completed Pages draft remains available if GitHub's API is rate limited. */ }
  try {
    const response = await fetchImpl(pagesFile('native-draft-status.json'), { cache: 'no-store' });
    if (response.ok) {
      const status = await response.json();
      return { state: 'complete', runId: Number(status.runId), checkedAt: status.checkedAt, createdAt: status.checkedAt, updatedAt: status.checkedAt, message: `Latest completed draft: ${status.stories} stories.`, runUrl: status.runUrl };
    }
  } catch { /* The first run may not have produced a draft yet. */ }
  return { state: 'idle', message: 'Ready to scrape.' };
}
