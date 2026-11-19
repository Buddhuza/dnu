import { sameNewsEvent } from './storyDuplicates.js';
import { NEWS_SECTIONS } from './newsSections.js';
import { stripFeedTeaser } from './feedHeadline.js';

const international = new Set(['reuters', 'ap', 'associated press', 'afp', 'bbc', 'dw', 'dpa', 'politico.eu', 'euronews', 'bloomberg', 'financial times', 'ft', 'the guardian', 'al jazeera', 'rfe/rl', 'voa', 'pbs', 'cnn']);
const regionalSections = new Set(NEWS_SECTIONS.slice(1, 5).map(section => section.id));
const significantHeadline = /\b(?:attack\w*|strike\w*|bomb\w*|missile\w*|drone\w*|kill\w*|war|ceasefire|peace deal|coup|invasion|troops?|military|sanction\w*|election\w*|resign\w*|protest\w*|border|security|agreement|arrest\w*|assassinat\w*|hostage\w*|nuclear|government collaps\w*|form(?:s|ed)? (?:a |the )?government)\b/i;
const agencyKey = name => ({ 'associated press': 'ap', 'politico europe': 'politico.eu' })[String(name || '').trim().toLowerCase()] || String(name || '').trim().toLowerCase();

export function internationalSource(article) {
  return international.has(String(article.sourceName || '').trim().toLowerCase());
}

function ukraineWarLeadScore(article) {
  if (!internationalSource(article) || article.sectionId !== 'Eastern Europe' || article.subsection !== 'Ukraine') return 0;
  const title = stripFeedTeaser(article.title);
  if (/\b\d+\s+(?:minutes?|mins?|hours?|hrs?|days?)\s+ago\b/i.test(title)) return 0;
  if (!/\b(?:Ukraine|Ukrainian|Kyiv|Odesa|Russia|Russian|Putin|Zelensk\w*)\b/i.test(title)) return 0;
  const majorDevelopment = /\b(?:ceasefire|peace (?:deal|agreement|talks)|security guarantees|negotiat\w*|strike\w*|attack\w*|airstrike\w*|missile\w*|drone\w*|offensive|frontline|troops?|weapon\w*|air defen[cs]e|military aid|sanction\w*)\b/i;
  if (!majorDevelopment.test(title)) return 0;
  return (/(?:ceasefire|peace (?:deal|agreement)|security guarantees|strike\w*|attack\w*|airstrike\w*|missile\w*|offensive)/i.test(title) ? 5 : 0)
    + (/(?:drone\w*|weapon\w*|air defen[cs]e|military aid|troops?)/i.test(title) ? 4 : 0)
    + (/(?:peace talks|negotiat\w*|talks? with Russia)/i.test(title) ? 2 : 0)
    + (article.body ? 1 : 0) + 1;
}

export function ensureUkraineWarLeads(articles, existingOrigins = {}) {
  const selected = articles.filter(article => article.sectionId === 'Lead stories' && article.subsection === 'Ukraine');
  const candidates = articles.map((article, index) => ({ article, index, score: ukraineWarLeadScore(article) }))
    .filter(candidate => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const visibleIds = new Set(articles.map(article => article.id));
  const promoted = [], origins = Object.fromEntries(Object.entries(existingOrigins || {}).filter(([id]) => visibleIds.has(id)));
  for (const { article } of candidates) {
    if (selected.length >= 2) break;
    if (selected.some(other => sameNewsEvent(article, other))) continue;
    selected.push(article);
    promoted.push(article);
    origins[article.id] = { sectionId: article.sectionId, subsection: article.subsection || '', country: article.country || '' };
  }
  const ids = new Set(promoted.map(article => article.id));
  return { articles: articles.map(article => ids.has(article.id)
    ? { ...article, title: stripFeedTeaser(article.title), sectionId: 'Lead stories', section: 'Lead stories', subsection: 'Ukraine', country: '' }
    : article), leadOrigins: origins, promoted };
}

function leadHeading(article) {
  if (article.sectionId === 'Lead stories') return article.subsection;
  if (article.sectionId === 'Miscellaneous') {
    if (article.subsection === 'MIDDLE EAST / NORTH AFRICA' && article.country !== 'Saudi Arabia' &&
      /\b(?:Iran|Israel|Gaza|Palestin\w*|Lebanon|Syria|Yemen|Houthi\w*|Hormuz)\b/i.test(`${article.title || ''} ${article.summary || ''}`) &&
      /\b(?:war|strike\w*|attack\w*|ceasefire|hostage\w*|military|missile\w*|drone\w*|nuclear|invasion|troops?|airstrike\w*|bomb\w*)\b/i.test(article.title || '')) return 'Middle East';
    return '';
  }
  return regionalSections.has(article.sectionId) ? article.subsection || article.sectionId : '';
}

export function selectWeekendStories(articles) {
  const ranked = articles.map((article, index) => ({ article, index })).sort((a, b) =>
    Number(internationalSource(b.article)) - Number(internationalSource(a.article)) || a.index - b.index);
  const kept = [], removed = [];
  for (const entry of ranked) {
    const match = kept.find(other => sameNewsEvent(entry.article, other));
    if (match) removed.push({ article: entry.article, preferred: match });
    else kept.push(entry.article);
  }
  const sources = new Map(kept.map(article => [article.id, new Set([agencyKey(article.sourceName)])]));
  for (const { article, preferred } of removed) sources.get(preferred.id)?.add(agencyKey(article.sourceName));
  const promoted = [], leadOrigins = {};
  const selected = kept.map(article => {
    const heading = leadHeading(article);
    if (article.sectionId === 'Lead stories' || !heading || !significantHeadline.test(article.title || '') || (sources.get(article.id)?.size || 0) < 3) return article;
    const origin = { sectionId: article.sectionId, subsection: article.subsection || '', country: article.country || '' };
    promoted.push({ article, heading, sourceCount: sources.get(article.id).size });
    leadOrigins[article.id] = origin;
    return { ...article, sectionId: 'Lead stories', section: 'Lead stories', subsection: heading, country: '' };
  });
  const ukraineLeads = ensureUkraineWarLeads(selected, leadOrigins);
  return { articles: ukraineLeads.articles, removed,
    promoted: [...promoted, ...ukraineLeads.promoted.map(article => ({ article, heading: 'Ukraine', sourceCount: sources.get(article.id)?.size || 1 }))],
    leadOrigins: ukraineLeads.leadOrigins };
}

export function viennaSchedule(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Vienna', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now).map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), minute: Number(parts.minute), weekend: ['Sat', 'Sun'].includes(parts.weekday) };
}

export function weekendSheetReadiness(sheet, date) {
  if (sheet?.date !== date || sheet.sheetName !== date || !sheet.rows?.length) return 'missing';
  if (sheet.runStatus === 'COMPLETE' && sheet.statusDate === date) return 'complete';
  if (sheet.runStatus && sheet.statusDate === date) return 'in-progress';
  return 'verify-stable';
}
