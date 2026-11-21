import { canonicalArticleUrl } from './siteConfig.js';

export function pendingRejectedStories(draft, config, publishedArticles = []) {
  const deleted = new Set(config.rejectedReview?.checkedAt === draft?.checkedAt ? config.rejectedReview.deletedIds : []);
  const publishedUrls = new Set([...publishedArticles, ...(config.customArticles || [])].map(item => canonicalArticleUrl(item.url)));
  return (draft?.editorialRejections || []).filter(item => item?.id && item?.title && !deleted.has(item.id)
    && !publishedUrls.has(canonicalArticleUrl(item.url)));
}

export function dismissRejectedStory(config, draftCheckedAt, id) {
  const prior = config.rejectedReview?.checkedAt === draftCheckedAt ? config.rejectedReview.deletedIds : [];
  return { ...config, rejectedReview: { checkedAt: draftCheckedAt, deletedIds: [...new Set([...prior, id])] } };
}
