import { readFileSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function viennaDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function needsAutosendScrape(draft, status, now = new Date()) {
  const valid = draft?.nativeEdition === true && Array.isArray(draft.articles) && draft.articles.length > 0 &&
    status?.checkedAt === draft.checkedAt && status?.stories === draft.articles.length &&
    Number.isSafeInteger(status?.runId) && status.runId > 0;
  return !valid || viennaDate(draft.checkedAt) !== viennaDate(now);
}

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch { return null; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [draftPath, statusPath] = process.argv.slice(2);
  if (!draftPath || !statusPath) throw new Error('Usage: autosend-freshness.mjs DRAFT_JSON STATUS_JSON');
  const scrape = needsAutosendScrape(readJson(draftPath), readJson(statusPath));
  const output = `scrape_needed=${scrape}\n`;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output);
  else process.stdout.write(output);
  console.log(scrape ? 'Latest scrape is not from today in Vienna; collecting before AUTOSEND.' : 'Latest scrape is from today in Vienna; using it for AUTOSEND.');
}
