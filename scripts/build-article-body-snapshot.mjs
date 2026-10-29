import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createArticleCache } from '../server/articleCache.js';
import { extractArticleBody } from '../server/articleBody.js';
import { articleJson } from '../src/articleTranslation.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = process.argv[2];
if (!output) throw new Error('Pass an output JSON path explicitly. Full article text must not be published by a routine build.');
const update = JSON.parse(readFileSync(join(root, 'data/prepared-update.json'), 'utf8'));
const archived = JSON.parse(readFileSync(join(root, 'data/daily-update-2026-10-24.json'), 'utf8'));
const cache = createArticleCache(join(root, 'data/article-cache.jsonl'));
const articles = {};
const cachedArticles = new Map([...archived.articles, ...update.articles].map(article => [article.url, article]));
for (const article of cachedArticles.values()) {
  const page = cache.get(article.url)?.page;
  const body = extractArticleBody(page, article.title);
  if (body.split(/\s+/).length < 25) continue;
  articles[article.url] = {
    heading: String(page?.metadata?.title || articleJson(page).exactHeadline || article.title).trim(),
    body,
    translated: article.translated === true
  };
}
writeFileSync(output, `${JSON.stringify({ editionCheckedAt: update.checkedAt, articles })}\n`);
console.log(`Prepared ${Object.keys(articles).length}/${cachedArticles.size} current and archived full article bodies at ${output}`);
