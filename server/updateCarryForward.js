import { canonicalUrl } from './previousCoverage.js';

export function carryForwardArticles(current, previous, windowStart, windowEnd, validSourceIds) {
  const start = Date.parse(windowStart);
  const end = Date.parse(windowEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) throw new Error('Invalid update window');
  const carried = (previous || []).filter(article => {
    const time = Date.parse(article.publishedAt);
    return Number.isFinite(time) && time >= start && time < end && validSourceIds.has(article.sourceId);
  });
  // A selected story's reviewed headline and summary take precedence over raw extraction.
  return [...new Map([...current, ...carried].map(article => [canonicalUrl(article.url), article])).values()];
}
