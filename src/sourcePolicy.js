const ukrainianSourceIds = new Set(Array.from({ length: 13 }, (_, index) => `source-${index + 33}`));
const ukrainianHosts = new Set([
  'interfax.com.ua', 'ukrinform.net', 'newsukraine.rbc.ua', 'pravda.com.ua',
  'kyivpost.com', 'hromadske.ua', 'kyivindependent.com', 'nikvesti.com',
  'khpg.org', 'ukranews.com', 'unn.ua', 'euromaidanpress.com', 'tsn.ua'
]);

export function isUkrainianOutlet(article) {
  if (ukrainianSourceIds.has(article.sourceId)) return true;
  try {
    const hostname = new URL(article.url).hostname.replace(/^www\./, '').toLowerCase();
    return hostname.endsWith('.ua') || [...ukrainianHosts].some(host => hostname === host || hostname.endsWith(`.${host}`));
  }
  catch { return false; }
}

export function isUkrainePlacement(place) {
  return (place.sectionId === 'Eastern Europe' || place.sectionId === 'Lead stories' || place.section === 'Eastern Europe' || place.section === 'Lead stories') && place.subsection === 'Ukraine';
}

export function disallowedUkraineSource(article, place = article) {
  return isUkrainePlacement(place) && isUkrainianOutlet(article);
}
