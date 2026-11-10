import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { currentDailyUpdate } from './daily.js';
import { canonicalArticleUrl } from '../src/siteConfig.js';

const editionPath = fileURLToPath(new URL('../data/prepared-update.json', import.meta.url));

export function readCompletedEdition(path = editionPath) {
  const edition = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(edition.articles) || !edition.checkedAt) throw new Error('The completed edition JSON is invalid.');
  return currentDailyUpdate(edition);
}

export function storedArticle(edition, url) {
  const key = canonicalArticleUrl(url);
  return edition.articles.find(article => canonicalArticleUrl(article.url) === key);
}

export function storedBody(article) {
  const body = String(article?.body || '').trim();
  if (!body) return null;
  return { heading: article.originalHeadline || article.title, body, translated: article.translated === true };
}
