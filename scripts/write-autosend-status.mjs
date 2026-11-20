import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const branch = 'refs/heads/autosend-status';
const outcomeNames = ['credentials', 'draft', 'publish', 'email'];

export function buildAutosendStatus(env, draftStatus, now = new Date()) {
  const steps = Object.fromEntries(outcomeNames.map(name => [name, env[`AUTOSEND_${name.toUpperCase()}_OUTCOME`] || 'unknown']));
  const runId = Number(env.GITHUB_RUN_ID);
  if (!Number.isSafeInteger(runId) || runId <= 0) throw new Error('Missing GitHub run ID.');
  const result = steps.publish === 'success' && steps.email === 'success' ? 'email_submitted'
    : steps.publish === 'success' ? 'published_email_unconfirmed'
      : steps.publish === 'failure' ? 'publication_unconfirmed' : 'not_published';
  return {
    version: 1,
    runId,
    runUrl: `https://github.com/${env.GITHUB_REPOSITORY}/actions/runs/${runId}`,
    commit: env.GITHUB_SHA || '',
    finishedAt: now.toISOString(),
    scheduledDate: env.AUTOSEND_SCHEDULED_DATE || null,
    result,
    steps,
    draft: draftStatus && typeof draftStatus === 'object' ? {
      checkedAt: draftStatus.checkedAt || null,
      stories: Number.isSafeInteger(draftStatus.stories) ? draftStatus.stories : null,
      runId: Number.isSafeInteger(draftStatus.runId) ? draftStatus.runId : null
    } : null
  };
}

function git(args, options = {}) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...options }).trim();
}

function publishStatus(status) {
  const contents = `${JSON.stringify(status, null, 2)}\n`;
  const blob = git(['hash-object', '-w', '--stdin'], { input: contents });
  const remote = git(['ls-remote', 'origin', branch]);
  const parent = remote ? remote.split(/\s+/)[0] : null;
  if (parent) git(['fetch', 'origin', branch]);
  let history = {};
  if (parent) {
    try { history = JSON.parse(git(['show', `${parent}:history.json`])); }
    catch { /* First scheduled run creates the history. */ }
  }
  if (status.scheduledDate && status.result === 'email_submitted') history[status.scheduledDate] = status.result;
  const historyBlob = git(['hash-object', '-w', '--stdin'], { input: `${JSON.stringify(history, null, 2)}\n` });
  const tree = git(['mktree'], { input: `100644 blob ${historyBlob}\thistory.json\n100644 blob ${blob}\tstatus.json\n` });
  const commit = git(['commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', `Record AUTOSEND run ${status.runId}`], {
    env: { ...process.env, GIT_AUTHOR_NAME: 'DNU Actions', GIT_AUTHOR_EMAIL: 'actions@users.noreply.github.com',
      GIT_COMMITTER_NAME: 'DNU Actions', GIT_COMMITTER_EMAIL: 'actions@users.noreply.github.com' }
  });
  git(['push', 'origin', `${commit}:${branch}`]);
}

function main() {
  let draftStatus = null;
  try { draftStatus = JSON.parse(readFileSync(process.argv[2], 'utf8')); }
  catch { /* The draft step may have failed before creating this file. */ }
  const status = buildAutosendStatus(process.env, draftStatus);
  publishStatus(status);
  console.log(`AUTOSEND ${status.runId}: ${status.result}; status saved to ${branch}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) { console.error(`Could not publish the AUTOSEND status: ${error.message}`); process.exitCode = 1; }
}
