import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const readJson = path => {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch { return null; }
};

export function collectionLogEntry({ runId, eventName, triggerOverride = '', conclusion, skipped = false, scheduledSlot = '', edition, progress, finishedAt = new Date().toISOString() }) {
  if (!Number.isSafeInteger(Number(runId)) || Number(runId) <= 0) throw new Error('A GitHub Actions run ID is required.');
  const trigger = ['manual', 'automatic'].includes(triggerOverride) ? triggerOverride : ['workflow_dispatch', 'push'].includes(eventName) ? 'manual' : 'automatic';
  const completed = conclusion === 'success' && edition?.nativeEdition === true && Array.isArray(edition.articles) && edition.articles.length > 0;
  const outcome = skipped ? 'skipped' : conclusion === 'success' ? 'succeeded' : conclusion === 'cancelled' ? 'cancelled' : 'failed';
  const startedAt = Number.isFinite(Date.parse(progress?.startedAt)) ? progress.startedAt : null;
  const stories = completed ? edition.articles.length : Number.isInteger(progress?.stories) ? progress.stories : null;
  const fullBodies = completed ? edition.articles.filter(article => String(article.body || '').trim()).length : null;
  const sourceRoutes = completed ? (edition.sourceOutcomes || []).length : null;
  const failedRoutes = completed ? (edition.sourceOutcomes || []).filter(item => item.status === 'failed').length : null;
  let description;
  if (skipped) description = 'GitHub started this scheduled slot more than 12 hours late. No scrape ran; the previous draft was retained.';
  else if (completed) description = `Saved ${stories} ${stories === 1 ? 'story' : 'stories'} from ${sourceRoutes} source ${sourceRoutes === 1 ? 'route' : 'routes'}. ${failedRoutes} ${failedRoutes === 1 ? 'route' : 'routes'} failed; ${fullBodies} full article ${fullBodies === 1 ? 'text' : 'texts'} available.`;
  else if (conclusion === 'success') description = 'The scrape completed and saved its draft, but the detailed collection report was unavailable.';
  else if (conclusion === 'cancelled') description = 'Scrape was cancelled before a completed draft was saved.';
  else if (progress?.state === 'complete') description = 'Collection finished, but the completed draft could not be saved to the website.';
  else description = `No completed draft was saved. ${String(progress?.message || 'The collection job failed before it reported a result.').trim()}`;
  if (scheduledSlot) description = `${scheduledSlot.replace('T', ' ').replace(' Europe/Vienna', '')} Vienna slot: ${description}`;
  return { runId: Number(runId), trigger, outcome, scheduledSlot: scheduledSlot || null, startedAt, finishedAt, description,
    stories, fullBodies, sourceRoutes, failedRoutes };
}

export function updateCollectionLog(existing, entry) {
  const entries = Array.isArray(existing?.entries) ? existing.entries : [];
  return { version: 1, entries: [entry, ...entries.filter(item => item?.runId !== entry.runId)]
    .sort((a, b) => Date.parse(b.finishedAt || '') - Date.parse(a.finishedAt || ''))
    .slice(0, 100) };
}

if (process.argv[1]?.endsWith('/write-native-collection-log.mjs')) {
  const [artifactDir, outputPath] = process.argv.slice(2);
  if (!artifactDir || !outputPath) throw new Error('Pass the downloaded artifact directory and output JSON path.');
  const entry = collectionLogEntry({
    runId: process.env.GITHUB_RUN_ID,
    eventName: process.env.GITHUB_EVENT_NAME,
    triggerOverride: process.env.DNU_COLLECTION_TRIGGER,
    conclusion: process.env.DNU_COLLECTION_RESULT,
    skipped: process.env.DNU_COLLECTION_SKIPPED === 'true',
    scheduledSlot: process.env.DNU_COLLECTION_SLOT || '',
    edition: readJson(join(artifactDir, 'prepared-update.json')),
    progress: readJson(join(artifactDir, 'native-collection-progress.json'))
  });
  writeFileSync(outputPath, `${JSON.stringify(updateCollectionLog(readJson(outputPath), entry))}\n`);
  console.log(`${entry.trigger} scrape ${entry.runId}: ${entry.outcome}. ${entry.description}`);
}
