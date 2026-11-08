import { sameNewsEvent } from './storyDuplicates.js';

const international = new Set(['reuters', 'ap', 'associated press', 'afp', 'bbc', 'dw', 'dpa', 'politico.eu', 'euronews', 'bloomberg', 'financial times', 'the guardian', 'al jazeera', 'rfe/rl', 'voa', 'pbs', 'cnn']);

export function internationalSource(article) {
  return international.has(String(article.sourceName || '').trim().toLowerCase());
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
  return { articles: kept, removed };
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
