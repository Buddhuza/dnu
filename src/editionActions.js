import { canonicalArticleUrl } from './siteConfig.js';

export function mergeImportedArticles(existing = [], incoming = []) {
  const merged = [...existing];
  const knownUrls = new Set(existing.map(article => canonicalArticleUrl(article.url)));
  for (const article of incoming) {
    const key = canonicalArticleUrl(article.url);
    if (knownUrls.has(key)) continue;
    knownUrls.add(key);
    merged.push(article);
  }
  return merged;
}

export function appendEditionStories(existing = {}, incoming = {}, additionalUrls = []) {
  const knownUrls = new Set(additionalUrls.map(canonicalArticleUrl));
  const newArticles = (incoming.articles || []).filter(article => !knownUrls.has(canonicalArticleUrl(article.url)));
  const articles = mergeImportedArticles(existing.articles || [], newArticles);
  const starts = [existing.windowStart, incoming.windowStart].map(Date.parse).filter(Number.isFinite);
  const ends = [existing.windowEnd, incoming.windowEnd].map(Date.parse).filter(Number.isFinite);
  const windowStart = starts.length ? new Date(Math.min(...starts)).toISOString() : incoming.windowStart;
  const windowEnd = ends.length ? new Date(Math.max(...ends)).toISOString() : incoming.windowEnd;
  return {
    ...existing, ...incoming, articles, windowStart, windowEnd,
    windowHours: Number.isFinite(Date.parse(windowStart)) && Number.isFinite(Date.parse(windowEnd))
      ? (Date.parse(windowEnd) - Date.parse(windowStart)) / 3_600_000 : incoming.windowHours,
    latestCollectionWindowStart: incoming.windowStart,
    latestCollectionWindowEnd: incoming.windowEnd
  };
}

export function latestCollectionArticles(edition = {}) {
  const urls = new Set((edition.latestCollectionArticleUrls || (edition.articles || []).map(article => article.url)).map(canonicalArticleUrl));
  return (edition.articles || []).filter(article => urls.has(canonicalArticleUrl(article.url)));
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
