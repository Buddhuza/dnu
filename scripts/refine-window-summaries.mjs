import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const update = JSON.parse(readFileSync(join(root, 'data/daily-update-2026-10-14-15.json'), 'utf8'));
const output = join(root, 'data/collection-2026-10-14-summary-fixes.json');
const state = existsSync(output) ? JSON.parse(readFileSync(output, 'utf8')) : {};
const key = process.env.FIRECRAWL_API_KEY;
if (!key) throw new Error('FIRECRAWL_API_KEY is not set');
const save = () => writeFileSync(output, `${JSON.stringify(state, null, 2)}\n`);
const stop = new Set('the a an to of in on for and with as at from is are was were by its their this that has have had says said will after over under into about more new'.split(' '));
function overlap(title, summary) {
  const words = text => new Set(String(text).toLocaleLowerCase().match(/[a-z]{3,}/g)?.filter(word => !stop.has(word)) || []);
  const headline = words(title);
  const body = words(summary);
  return [...headline].filter(word => body.has(word)).length / Math.max(1, headline.size);
}
const candidates = update.articles.filter(article => overlap(article.title, article.summary) >= 0.63 && !state[article.url]);
const prompt = 'Read the original English news article. Return a JSON object with a summary field containing exactly one short factual sentence. Use a concrete detail from the first two substantive paragraphs that is absent from the headline: a figure, named actor, specific action, place, agreement, reason, or consequence. Do not restate or paraphrase the headline; omit any clause whose only purpose is to repeat it. Do not add opinion, prediction, or information not present on the page. If there is no new detail, return an empty summary.';

async function request(url, options) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(45000) });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.success !== false) return data;
    if (response.status !== 429 || attempt === 2) throw new Error(data.error || data.message || `HTTP ${response.status}`);
    await new Promise(resolve => setTimeout(resolve, 15000));
  }
}

for (let offset = 0; offset < candidates.length; offset += 10) {
  const group = candidates.slice(offset, offset + 10);
  const batch = await request('https://api.firecrawl.dev/v2/batch/scrape', { method: 'POST', body: JSON.stringify({ urls: group.map(article => article.url), formats: [{ type: 'json', prompt }], onlyMainContent: true, timeout: 30000 }) });
  const pages = new Map();
  for (let attempt = 0; attempt < 45; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 4000));
    const status = await request(`https://api.firecrawl.dev/v2/batch/scrape/${batch.id}`);
    for (const page of status.data || []) {
      const url = page.metadata?.sourceURL || page.metadata?.url;
      if (url) pages.set(url, page);
    }
    if (status.status === 'failed') throw new Error(status.error || `Batch ${batch.id} failed`);
    if (status.status === 'completed' || status.completed >= status.total) break;
  }
  for (const article of group) {
    const page = pages.get(article.url);
    const extracted = typeof page?.json === 'string' ? JSON.parse(page.json) : page?.json || {};
    const replacement = String(extracted.summary || '').trim();
    const before = overlap(article.title, article.summary);
    const after = overlap(article.title, replacement);
    state[article.url] = { title: article.title, originalSummary: article.summary, replacement: replacement && after < before && replacement.length >= 35 ? replacement : '', overlapBefore: before, overlapAfter: after };
  }
  save();
  console.log(`SUMMARY ${Math.min(offset + group.length, candidates.length)}/${candidates.length}: ${Object.values(state).filter(item => item.replacement).length} improved`);
}
console.log(`SUMMARY COMPLETE: ${Object.values(state).filter(item => item.replacement).length} improved of ${Object.keys(state).length} reviewed`);
