import legacyFeedrunUrls from '../data/legacy-feedrun-urls.json' with { type: 'json' };
import { canonicalArticleUrl } from './siteConfig.js';

const legacyFeedrunKeys = new Set(legacyFeedrunUrls.map(canonicalArticleUrl));

export function storyOrigin(article) {
  if (article.ingestMethod === 'import' || article.fromSpreadsheet === true) return 'import';
  if (article.ingestMethod === 'add' || article.sourceId === 'manual' || String(article.id || '').startsWith('manual-')) return 'add';
  if (article.ingestMethod === 'feedrun' || article.url && legacyFeedrunKeys.has(canonicalArticleUrl(article.url))) return 'feedrun';
  return 'other';
}
