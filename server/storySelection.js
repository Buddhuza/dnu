import { editorialScore } from './editorialPolicy.js';

const regionalSections = new Set(['South Eastern Europe', 'Eastern Europe', 'South Caucasus', 'Central Asia']);

export function storyHeadingKey(article) {
  if (article.section === 'Lead stories') return article.subsection === 'Middle East' ? '' : article.subsection || '';
  if (regionalSections.has(article.section)) return article.subsection || '';
  if (article.section === 'Miscellaneous') return article.country || '';
  return '';
}

function sourceWeight(name) {
  if (/^Reuters$/i.test(name)) return 6;
  if (/^(?:AP|AFP)$/i.test(name)) return 5;
  if (/^(?:BBC|DW|dpa|Euronews|Politico\.eu|Guardian)$/i.test(name)) return 4;
  if (/^(?:Al Jazeera|RFE\/RL|NBC|PBS|NPR|LRT|ANSA|BIRN)$/i.test(name)) return 3;
  return 1;
}

export function storyImportance(article, windowStart, windowEnd) {
  const title = String(article.title || '');
  const text = `${title} ${article.summary || ''}`;
  const start = Date.parse(windowStart), end = Date.parse(windowEnd), published = Date.parse(article.publishedAt);
  const recency = Number.isFinite(start) && Number.isFinite(end) && Number.isFinite(published) && end > start
    ? Math.max(0, Math.min(1, (published - start) / (end - start))) * 12 : 0;
  return (article.section === 'Lead stories' ? 1000 : 0) + editorialScore(title, article.summary) + sourceWeight(article.sourceName) * 10
    + (/\b(?:strike\w*|attack\w*|kill\w*|ceasefire|sanction\w*|sabotage|military operation|peace agreement|election|resign\w*|diplomatic break)\b/i.test(title) ? 35 : 0)
    + (/\b(?:OSCE|NATO|EU|UN|treaty|agreement|security cooperation)\b/i.test(text) ? 15 : 0)
    - (/\b(?:could|might|may|plans?|seeks?|experts?|opinion|analysis)\b/i.test(title) ? 14 : 0) + recency;
}

export function limitStoriesPerHeading(articles, { limit = 10, windowStart, windowEnd, priorities = {} } = {}) {
  const byHeading = new Map();
  articles.forEach((article, index) => {
    const key = storyHeadingKey(article);
    if (!key) return;
    if (!byHeading.has(key)) byHeading.set(key, []);
    byHeading.get(key).push({ article, index });
  });
  const removed = new Set();
  for (const entries of byHeading.values()) {
    if (entries.length <= limit) continue;
    const remaining = [...entries];
    const sourceCounts = new Map();
    for (let selected = 0; selected < limit; selected++) {
      remaining.sort((a, b) => {
        const weighted = entry => storyImportance(entry.article, windowStart, windowEnd) + (Number(priorities[entry.article.url]) || 0) - (sourceCounts.get(entry.article.sourceName) || 0) * 10;
        return weighted(b) - weighted(a) || Date.parse(b.article.publishedAt) - Date.parse(a.article.publishedAt) || a.index - b.index;
      });
      const winner = remaining.shift();
      sourceCounts.set(winner.article.sourceName, (sourceCounts.get(winner.article.sourceName) || 0) + 1);
    }
    for (const entry of remaining) removed.add(entry.index);
  }
  return { kept: articles.filter((_, index) => !removed.has(index)), removed: articles.filter((_, index) => removed.has(index)) };
}
