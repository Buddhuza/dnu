import { canonicalArticleUrl } from './siteConfig.js';

export function mergeImportedArticles(existing = [], incoming = []) {
  const merged = [...existing];
  const indexes = new Map(existing.map((article, index) => [canonicalArticleUrl(article.url), index]));
  for (const article of incoming) {
    const key = canonicalArticleUrl(article.url);
    const index = indexes.get(key);
    if (index === undefined) {
      indexes.set(key, merged.length);
      merged.push(article);
    } else {
      merged[index] = { ...article, id: merged[index].id };
    }
  }
  return merged;
}

export function removeStoryFromEdition(edition, storyId) {
  if (!edition) return edition;
  return { ...edition, articles: (edition.articles || []).filter(article => article.id !== storyId) };
}

export function removeStoryFromConfig(config, storyId) {
  const { [storyId]: removedEdit, ...articleEdits } = config.articleEdits || {};
  const { [storyId]: removedOrigin, ...leadOrigins } = config.leadOrigins || {};
  return {
    ...config,
    customArticles: (config.customArticles || []).filter(article => article.id !== storyId),
    articleOrder: (config.articleOrder || []).filter(id => id !== storyId),
    articleEdits,
    leadOrigins
  };
}
