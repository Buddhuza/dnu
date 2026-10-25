import { editorialScore } from './editorialPolicy.js';

const regionalSections = new Set(['South Eastern Europe', 'Eastern Europe', 'South Caucasus', 'Central Asia']);

export function storyHeadingKey(article) {
  if (article.section === 'Lead stories') return '';
  if (regionalSections.has(article.section)) return article.subsection || '';
  if (article.section === 'Miscellaneous') return article.country || '';
  return '';
}

export function balanceAgencyShare(articles, alternatives, { sameEvent, windowStart, windowEnd, priorities = {}, maxShare = 0.5, qualityTolerance = 25 } = {}) {
  const selected = [...articles];
  const replacements = [];
  const groups = new Map();
  selected.forEach((article, index) => {
    const heading = storyHeadingKey(article);
    if (!heading) return;
    const key = `${article.section}|${article.subsection}|${heading}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(index);
  });
  for (const [key, indexes] of groups) {
    if (indexes.length < 2) continue;
    const target = Math.ceil(indexes.length * maxShare);
    const counts = new Map();
    for (const index of indexes) counts.set(selected[index].sourceName, (counts.get(selected[index].sourceName) || 0) + 1);
    for (const index of indexes) {
      const current = selected[index];
      if ((counts.get(current.sourceName) || 0) <= target) continue;
      const currentImportance = storyImportance(current, windowStart, windowEnd) + (Number(priorities[current.url]) || 0);
      const choices = alternatives.filter(candidate => {
        const heading = storyHeadingKey(candidate);
        if (`${candidate.section}|${candidate.subsection}|${heading}` !== key || candidate.sourceName === current.sourceName) return false;
        if ((counts.get(candidate.sourceName) || 0) >= target || selected.some(article => article.url === candidate.url)) return false;
        if (typeof sameEvent !== 'function' || !sameEvent(current, candidate)) return false;
        return storyImportance(candidate, windowStart, windowEnd) + (Number(priorities[candidate.url]) || 0) >= currentImportance - qualityTolerance;
      }).sort((a, b) => storyImportance(b, windowStart, windowEnd) + (Number(priorities[b.url]) || 0) - storyImportance(a, windowStart, windowEnd) - (Number(priorities[a.url]) || 0));
      const replacement = choices[0];
      if (!replacement) continue;
      selected[index] = replacement;
      counts.set(current.sourceName, counts.get(current.sourceName) - 1);
      counts.set(replacement.sourceName, (counts.get(replacement.sourceName) || 0) + 1);
      replacements.push({ original: current, replacement });
    }
  }
  return { articles: selected, replacements };
}

export function selectDiverseLeadStories(candidates, limit, score, qualityTolerance = 25) {
  const remaining = [...candidates].sort((a, b) => score(b) - score(a));
  const selected = [];
  const sourceCounts = new Map();
  const targetPerAgency = Math.floor(limit / 2);
  while (remaining.length && selected.length < limit) {
    const best = remaining[0];
    const choice = (sourceCounts.get(best.sourceName) || 0) >= targetPerAgency
      ? remaining.find(article => (sourceCounts.get(article.sourceName) || 0) < targetPerAgency && score(article) >= score(best) - qualityTolerance) || remaining.find(article => (sourceCounts.get(article.sourceName) || 0) < targetPerAgency) || best
      : best;
    remaining.splice(remaining.indexOf(choice), 1);
    selected.push(choice);
    sourceCounts.set(choice.sourceName, (sourceCounts.get(choice.sourceName) || 0) + 1);
  }
  return selected;
}

function sourceWeight(name) {
  if (/^(?:Euronews\.al|N1|Civil\.ge)$/i.test(name)) return 4;
  if (/^(?:TemA|Tanjug|1TV)$/i.test(name)) return 0;
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
    const targetPerAgency = Math.ceil(limit / 2);
    for (let selected = 0; selected < limit; selected++) {
      remaining.sort((a, b) => {
        const weighted = entry => storyImportance(entry.article, windowStart, windowEnd) + (Number(priorities[entry.article.url]) || 0) - (sourceCounts.get(entry.article.sourceName) || 0) * 10;
        return weighted(b) - weighted(a) || Date.parse(b.article.publishedAt) - Date.parse(a.article.publishedAt) || a.index - b.index;
      });
      let winner = remaining[0];
      if ((sourceCounts.get(winner.article.sourceName) || 0) >= targetPerAgency) {
        const topImportance = storyImportance(winner.article, windowStart, windowEnd) + (Number(priorities[winner.article.url]) || 0);
        winner = remaining.find(entry => (sourceCounts.get(entry.article.sourceName) || 0) < targetPerAgency
          && storyImportance(entry.article, windowStart, windowEnd) + (Number(priorities[entry.article.url]) || 0) >= topImportance - 25) || winner;
      }
      remaining.splice(remaining.indexOf(winner), 1);
      sourceCounts.set(winner.article.sourceName, (sourceCounts.get(winner.article.sourceName) || 0) + 1);
    }
    for (const entry of remaining) removed.add(entry.index);
  }
  return { kept: articles.filter((_, index) => !removed.has(index)), removed: articles.filter((_, index) => removed.has(index)) };
}
