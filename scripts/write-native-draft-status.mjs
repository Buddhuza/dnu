import { readFileSync, writeFileSync } from 'node:fs';

const [editionPath, outputPath] = process.argv.slice(2);
if (!editionPath || !outputPath) throw new Error('Pass the completed edition and output paths.');
const edition = JSON.parse(readFileSync(editionPath, 'utf8'));
if (edition.nativeEdition !== true || !edition.checkedAt || !Array.isArray(edition.articles) || !edition.articles.length)
  throw new Error('The native edition is incomplete; the earlier review draft is unchanged.');
const runId = Number(process.env.GITHUB_RUN_ID);
if (!Number.isInteger(runId) || runId <= 0) throw new Error('A GitHub Actions run ID is required.');
let previous = null;
try { previous = JSON.parse(readFileSync(outputPath, 'utf8')); }
catch { /* The first scrape has no earlier checkpoint. */ }
const status = {
  runId, checkedAt: edition.checkedAt, finishedAt: new Date().toISOString(), stories: edition.articles.length,
  trigger: ['workflow_dispatch', 'push'].includes(process.env.GITHUB_EVENT_NAME) ? 'manual' : 'automatic',
  lastCompletedSlot: process.env.DNU_SCHEDULED_SLOT || previous?.lastCompletedSlot || null,
  bodies: edition.articles.filter(article => String(article.body || '').trim()).length,
  failedRoutes: (edition.sourceOutcomes || []).filter(outcome => outcome.status === 'failed').length,
  runUrl: `https://github.com/Buddhuza/dnu/actions/runs/${runId}`
};
writeFileSync(outputPath, `${JSON.stringify(status)}\n`);
