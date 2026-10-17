import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createArticleCache } from '../server/articleCache.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const day = process.env.COLLECTION_DAY || new Date().toISOString().slice(0, 10);
const cache = createArticleCache(join(root, 'data/article-cache.jsonl'));
let seeded = 0;
for (const path of [`data/collection-${day}-working.json`, 'data/prepared-update.json']) {
  const file = join(root, path);
  if (!existsSync(file)) continue;
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const articles = data.articles || Object.values(data.sources || {}).flatMap(source => source.articles || []);
  for (const article of articles) {
    if (!article.url || cache.get(article.url)?.article) continue;
    cache.putArticle(article.url, article);
    seeded++;
  }
}
console.log(`Seeded ${seeded} already collected articles; existing cached entries were preserved.`);
