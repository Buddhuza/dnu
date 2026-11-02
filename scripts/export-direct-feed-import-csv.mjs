import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createArticleCache } from '../server/articleCache.js';
import { extractArticleBody } from '../server/articleBody.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const edition = JSON.parse(readFileSync(join(root, 'data/prepared-update.json'), 'utf8'));
const audit = JSON.parse(readFileSync(join(root, process.env.FEEDRUN_AUDIT_PATH || 'data/direct-feed-36h-result.json'), 'utf8'));
const byUrl = new Map(audit.articles.map(article => [article.url, article]));
const cache = createArticleCache(join(root, 'data/article-cache.jsonl'));
const regions = {
  'WESTERN / CENTRAL EUROPE': 'Europe',
  'MIDDLE EAST / NORTH AFRICA': 'Middle East',
  'RUSSIA / EURASIA': 'Eurasia',
  'NORTH EAST ASIA': 'North East Asia',
  'NORTH AMERICA': 'North America',
  'INTERNATIONAL ORGANISATIONS': 'International Organisations'
};
const header = ['Published UTC', 'Source', 'Region', 'Countries', 'Organisations', 'Source URL', 'Heading', 'DNU Summary', 'Body'];
const rows = edition.articles.map(article => {
  const body = byUrl.get(article.url)?.body || extractArticleBody(cache.get(article.url)?.page, article.title);
  if (!body) throw new Error(`Missing full body for ${article.url}`);
  const region = article.section === 'Lead stories' ? article.section : article.section === 'Miscellaneous' ? regions[article.subsection] : article.section;
  const countries = article.section === 'Lead stories' || article.section !== 'Miscellaneous' ? article.subsection : article.subsection === 'INTERNATIONAL ORGANISATIONS' ? '' : article.country;
  const organisations = article.subsection === 'INTERNATIONAL ORGANISATIONS' ? article.country : '';
  return [article.publishedAt, article.sourceName, region, countries, organisations, article.url, article.title, article.summary, body.replace(/[ \t]+$/gm, '')];
});
const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
const output = join(root, process.env.FEEDRUN_IMPORT_PATH || 'data/dnu-import-2026-10-31.csv');
writeFileSync(output, `${[header, ...rows].map(row => row.map(quote).join(',')).join('\n')}\n`);
console.log(`Prepared ${rows.length} rows in ${output}`);
