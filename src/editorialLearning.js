import { canonicalArticleUrl } from './siteConfig.js';

const stopWords = new Set(['about', 'after', 'amid', 'from', 'into', 'over', 'says', 'said', 'that', 'their', 'the', 'this', 'with', 'will']);
const words = value => [...new Set(String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .match(/[a-z0-9]{3,}/g)?.filter(word => !stopWords.has(word)) || [])];
const normalisedTitle = value => words(value).join(' ');
const sourceKey = value => String(value || '').trim().toLowerCase();

export function recordEditorialDecision(config, article, action, placement = {}, at = new Date().toISOString()) {
  if (!['approve', 'reject'].includes(action) || !article?.title || !article?.url) return config;
  const decision = {
    action, title: article.title, sourceName: article.sourceName || '', url: article.url, at,
    sectionId: action === 'approve' ? placement.sectionId || '' : '',
    subsection: action === 'approve' ? placement.subsection || '' : '',
    country: action === 'approve' ? placement.country || '' : ''
  };
  const key = canonicalArticleUrl(article.url);
  const prior = (config.editorialLearning || []).filter(item => canonicalArticleUrl(item.url) !== key);
  return { ...config, editorialLearning: [...prior, decision].slice(-500) };
}

export function matchingEditorialDecision(article, decisions = []) {
  const url = canonicalArticleUrl(article.url || article.link);
  const title = normalisedTitle(article.title || article.headline);
  const currentWords = words(article.title || article.headline);
  const source = sourceKey(article.sourceName || article.source);
  for (const item of [...decisions].reverse()) {
    if (url && url === canonicalArticleUrl(item.url)) return item;
    const learnedTitle = normalisedTitle(item.title);
    if (!title || !learnedTitle) continue;
    if (title === learnedTitle) return item;
    if (source !== sourceKey(item.sourceName)) continue;
    const learnedWords = words(item.title);
    const shared = currentWords.filter(word => learnedWords.includes(word)).length;
    if (shared >= 4 && shared / Math.max(currentWords.length, learnedWords.length) >= 0.75) return item;
  }
  return null;
}
