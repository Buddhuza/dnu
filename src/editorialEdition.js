import { displaySourceName } from './sourceNames.js';
import { cleanHeadlinePrefix } from './headlineText.js';
import { directGovernmentPublicationReason, paywalledSourceReason, unattributedRepublisherReason, blockedPlacementReason } from './sourcePolicy.js';
import { excludedHeadlineReason } from './headlinePolicy.js';
import { editorialPlacement } from './editorialPlacement.js';

export function reviewPublishedEdition(edition, settings) {
  const removed = [], articles = [], moved = [];
  const correctedPlacements = new Map();
  for (const article of edition.articles || []) {
    const edit = settings.articleEdits?.[article.id] || {};
    const title = cleanHeadlinePrefix(article.title);
    const sourceName = displaySourceName(article.sourceName, article);
    const editedSourceName = unattributedRepublisherReason({ sourceName: edit.sourceName }) ? sourceName : edit.sourceName || sourceName;
    const effective = {
      ...article, title: edit.title || title, sourceName: editedSourceName,
      sectionId: edit.sectionId || article.sectionId || article.section,
      subsection: edit.sectionId ? edit.subsection : edit.subsection || article.subsection,
      country: edit.sectionId ? edit.country : edit.country || article.country || ''
    };
    const correction = editorialPlacement(effective.title);
    if (correction) Object.assign(effective, correction);
    const reason = directGovernmentPublicationReason(effective) || paywalledSourceReason(effective) || unattributedRepublisherReason(effective) ||
      excludedHeadlineReason(effective.title, effective.summary, effective.url) || blockedPlacementReason(effective);
    if (reason) removed.push({ title: effective.title, sourceName: effective.sourceName, reason });
    else {
      if (correction) {
        correctedPlacements.set(article.id, correction);
        if (article.sectionId !== correction.sectionId || article.subsection !== correction.subsection || (article.country || '') !== correction.country)
          moved.push({ title: effective.title, sourceName: effective.sourceName, placement: correction });
      }
      articles.push({ ...article, title, sourceName, ...(correction || {}), ...(correction ? { editorialPlacementLocked: true } : {}) });
    }
  }
  const kept = new Set([...articles.map(article => article.id), ...(settings.customArticles || []).map(article => article.id)]);
  const articleEdits = Object.fromEntries(Object.entries(settings.articleEdits || {}).filter(([id]) => kept.has(id)).map(([id, edit]) => {
    const article = articles.find(item => item.id === id);
    return [id, article && unattributedRepublisherReason({ sourceName: edit.sourceName }) ? { ...edit, sourceName: article.sourceName } : edit];
  }));
  for (const [id, placement] of correctedPlacements) articleEdits[id] = { ...(articleEdits[id] || {}), ...placement };
  return {
    edition: { ...edition, articles },
    settings: {
      ...settings,
      articleEdits,
      articleOrder: (settings.articleOrder || []).filter(id => kept.has(id)),
      leadOrigins: Object.fromEntries(Object.entries(settings.leadOrigins || {}).filter(([id]) => kept.has(id) && !correctedPlacements.has(id)))
    },
    removed, moved
  };
}
