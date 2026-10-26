import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const runId = process.env.COLLECTION_RUN_ID;
if (!runId || !/^[a-zA-Z0-9-]+$/.test(runId)) throw new Error('COLLECTION_RUN_ID must identify the collection run');

const sources = JSON.parse(readFileSync('sources.json', 'utf8'));
const checkpoint = JSON.parse(readFileSync(join('data', `collection-${runId}-working.json`), 'utf8'));
const update = JSON.parse(readFileSync('data/prepared-update.json', 'utf8'));
const incomplete = sources.filter(source => checkpoint.sources[source.id]?.status !== 'complete');
const outcomes = new Map((update.sourceOutcomes || []).map(outcome => [outcome.id, outcome]));
const missingOutcomes = sources.filter(source => !outcomes.has(source.id));
const collected = sources.filter(source => outcomes.get(source.id)?.status === 'collected');
const failed = sources.filter(source => outcomes.get(source.id)?.status === 'failed');
const checkedWithoutSelection = sources.filter(source => outcomes.get(source.id)?.status === 'checked');

const lines = [
  '# Daily collection test',
  '',
  `Coverage: ${checkpoint.windowStart} to ${checkpoint.windowEnd}`,
  '',
  `- Sources visited: ${sources.length - incomplete.length}/${sources.length}`,
  `- Sources with selected stories: ${collected.length}`,
  `- Sources checked without a selected story: ${checkedWithoutSelection.length}`,
  `- Sources with collection failures: ${failed.length}`,
  `- Stories in draft: ${update.articles.length}`,
  '',
  'This manual test does not publish the draft to the website.',
  '',
  '## Collection failures',
  '',
  ...(!incomplete.length && !failed.length ? ['None.'] : [
    ...incomplete.map(source => `- ${source.name}: collection did not finish`),
    ...failed.map(source => `- ${source.name}: ${outcomes.get(source.id).reason}`)
  ]),
  '',
  '## Sources checked without a selected story',
  '',
  ...(!checkedWithoutSelection.length ? ['None.'] : checkedWithoutSelection.map(source => `- ${source.name}: ${outcomes.get(source.id).reason}`)),
  ''
];
const report = lines.join('\n');
writeFileSync('data/collection-test-summary.md', report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
console.log(report);
if (incomplete.length || missingOutcomes.length || update.articles.length === 0) {
  throw new Error(`Incomplete run: ${incomplete.length} sources unfinished, ${missingOutcomes.length} without audit rows, ${update.articles.length} draft stories`);
}
