import { displaySourceName } from './sourceNames.js';
import { cleanHeadlinePrefix } from './headlineText.js';
import { directGovernmentPublicationReason, paywalledSourceReason, blockedPlacementReason } from './sourcePolicy.js';
import { excludedHeadlineReason } from './headlinePolicy.js';

export function reviewPublishedEdition(edition, settings) {
  const removed = [], articles = [];
  for (const article of edition.articles || []) {
    const edit = settings.articleEdits?.[article.id] || {};
    const title = cleanHeadlinePrefix(article.title);
    const sourceName = displaySourceName(article.sourceName, article);
    const effective = {
      ...article, title: edit.title || title, sourceName: edit.sourceName || sourceName,
      sectionId: edit.sectionId || article.sectionId || article.section,
      subsection: edit.sectionId ? edit.subsection : edit.subsection || article.subsection,
      country: edit.sectionId ? edit.country : edit.country || article.country || ''
    };
    const reason = directGovernmentPublicationReason(effective) || paywalledSourceReason(effective) ||
      excludedHeadlineReason(effective.title, effective.summary, effective.url) || blockedPlacementReason(effective);
    if (reason) removed.push({ title: effective.title, sourceName: effective.sourceName, reason });
    else articles.push({ ...article, title, sourceName });
  }
  const kept = new Set([...articles.map(article => article.id), ...(settings.customArticles || []).map(article => article.id)]);
  return {
    edition: { ...edition, articles },
    settings: {
      ...settings,
      articleEdits: Object.fromEntries(Object.entries(settings.articleEdits || {}).filter(([id]) => kept.has(id))),
      articleOrder: (settings.articleOrder || []).filter(id => kept.has(id)),
      leadOrigins: Object.fromEntries(Object.entries(settings.leadOrigins || {}).filter(([id]) => kept.has(id)))
    },
    removed
  };
}
