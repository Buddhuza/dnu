import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createArticleCache } from '../server/articleCache.js';
import { extractArticleBody } from '../server/articleBody.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = process.argv[2];
if (!output) throw new Error('Pass an output JSON path explicitly. Full article text must not be published by a routine build.');
const update = JSON.parse(readFileSync(join(root, 'data/prepared-update.json'), 'utf8'));
const cache = createArticleCache(join(root, 'data/article-cache.jsonl'));
const articles = {};
for (const article of update.articles) {
  const page = cache.get(article.url)?.page;
  const body = extractArticleBody(page, article.title);
  if (body.split(/\s+/).length < 25) continue;
  articles[article.url] = {
    heading: String(page?.metadata?.title || page?.json?.exactHeadline || article.title).trim(),
    body
  };
}
writeFileSync(output, `${JSON.stringify({ editionCheckedAt: update.checkedAt, articles })}\n`);
console.log(`Prepared ${Object.keys(articles).length}/${update.articles.length} full article bodies at ${output}`);
