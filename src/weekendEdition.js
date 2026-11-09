import { sameNewsEvent } from './storyDuplicates.js';
import { NEWS_SECTIONS } from './newsSections.js';

const international = new Set(['reuters', 'ap', 'associated press', 'afp', 'bbc', 'dw', 'dpa', 'politico.eu', 'euronews', 'bloomberg', 'financial times', 'ft', 'the guardian', 'al jazeera', 'rfe/rl', 'voa', 'pbs', 'cnn']);
const regionalSections = new Set(NEWS_SECTIONS.slice(1, 5).map(section => section.id));
const significantHeadline = /\b(?:attack\w*|strike\w*|bomb\w*|missile\w*|drone\w*|kill\w*|war|ceasefire|peace deal|coup|invasion|troops?|military|sanction\w*|election\w*|resign\w*|protest\w*|border|security|agreement|arrest\w*|assassinat\w*|hostage\w*|nuclear|government collaps\w*|form(?:s|ed)? (?:a |the )?government)\b/i;
const agencyKey = name => ({ 'associated press': 'ap', 'politico europe': 'politico.eu' })[String(name || '').trim().toLowerCase()] || String(name || '').trim().toLowerCase();

export function internationalSource(article) {
  return international.has(String(article.sourceName || '').trim().toLowerCase());
}

function leadHeading(article) {
  if (article.sectionId === 'Lead stories') return article.subsection;
  if (article.sectionId === 'Miscellaneous') {
    if (article.subsection === 'MIDDLE EAST / NORTH AFRICA') return 'Middle East';
    if (article.subsection === 'INTERNATIONAL ORGANISATIONS') return article.country === 'OSCE' ? 'OSCE' : '';
    return article.country || '';
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
  return { articles: selected, removed, promoted, leadOrigins };
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
