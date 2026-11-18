import { isScheduledGmailCandidate } from './scheduled-gmail.js';

const workflowApi = 'https://api.github.com/repos/Buddhuza/dnu/actions';
const headers = token => ({
  accept: 'application/vnd.github+json', authorization: `Bearer ${token}`,
  'x-github-api-version': '2022-11-28'
});

async function githubJson(url, token, fetchImpl) {
  const response = await fetchImpl(url, { headers: headers(token), signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Could not check earlier Gmail deliveries (HTTP ${response.status}).`);
  return response.json();
}

export async function shouldSendScheduledGmail({ eventName, cron, token, runId, now = new Date(), fetchImpl = fetch }) {
  if (eventName !== 'schedule') return true;
  if (!isScheduledGmailCandidate(cron, now)) return false;
  if (/^30\s/.test(cron)) return true;
  if (!token) throw new Error('GitHub Actions token is required to check earlier deliveries.');
  const date = now.toISOString().slice(0, 10);
  const runs = await githubJson(`${workflowApi}/workflows/send-dnu-gmail.yml/runs?event=schedule&per_page=30`, token, fetchImpl);
  for (const run of runs.workflow_runs || []) {
    if (String(run.id) === String(runId) || run.conclusion !== 'success' || !run.created_at?.startsWith(date)) continue;
    const jobs = await githubJson(`${workflowApi}/runs/${run.id}/jobs?per_page=30`, token, fetchImpl);
    if ((jobs.jobs || []).some(job => (job.steps || []).some(step =>
      step.name === 'Send from the situation room Gmail account' && step.conclusion === 'success'))) return false;
  }
  return true;
}

if (process.argv[1]?.endsWith('/should-send-scheduled-gmail.mjs')) {
  shouldSendScheduledGmail({
    eventName: process.env.GITHUB_EVENT_NAME,
    cron: process.env.CRON_SCHEDULE,
    token: process.env.GITHUB_TOKEN,
    runId: process.env.GITHUB_RUN_ID
  }).then(send => {
    console.log(`send=${send}`);
    console.error(send ? 'This is the due Gmail delivery slot.' : 'Skipping this schedule; an edition was already sent or this is the other time-zone candidate.');
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
