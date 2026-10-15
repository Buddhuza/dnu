const ukrainianSourceIds = new Set(Array.from({ length: 13 }, (_, index) => `source-${index + 33}`));
const ukrainianHosts = new Set([
  'interfax.com.ua', 'ukrinform.net', 'newsukraine.rbc.ua', 'pravda.com.ua',
  'kyivpost.com', 'hromadske.ua', 'kyivindependent.com', 'nikvesti.com',
  'khpg.org', 'ukranews.com', 'unn.ua', 'euromaidanpress.com', 'tsn.ua'
]);
const armenianSourceIds = new Set(Array.from({ length: 9 }, (_, index) => `source-${index + 46}`));
const azerbaijaniSourceIds = new Set(Array.from({ length: 6 }, (_, index) => `source-${index + 55}`));
const armenianHosts = new Set(['arminfo.info']);

function sourceHost(article) {
  try { return new URL(article.url).hostname.replace(/^www\./, '').toLowerCase(); }
  catch { return ''; }
}

export function isUkrainianOutlet(article) {
  if (ukrainianSourceIds.has(article.sourceId)) return true;
  const hostname = sourceHost(article);
  return hostname.endsWith('.ua') || [...ukrainianHosts].some(host => hostname === host || hostname.endsWith(`.${host}`));
}

export function isArmenianOutlet(article) {
  const hostname = sourceHost(article);
  return armenianSourceIds.has(article.sourceId) || hostname.endsWith('.am') || armenianHosts.has(hostname);
}

export function isAzerbaijaniOutlet(article) {
  return azerbaijaniSourceIds.has(article.sourceId) || sourceHost(article).endsWith('.az');
}

export function isUkrainePlacement(place) {
  return (place.sectionId === 'Eastern Europe' || place.sectionId === 'Lead stories' || place.section === 'Eastern Europe' || place.section === 'Lead stories') && place.subsection === 'Ukraine';
}

export function disallowedUkraineSource(article, place = article) {
  return isUkrainePlacement(place) && isUkrainianOutlet(article);
}

export function blockedPlacementReason(article, place = article) {
  if (disallowedUkraineSource(article, place)) return 'Ukrainian outlet excluded from Ukraine coverage';
  const section = place.sectionId || place.section;
  if (section !== 'South Caucasus' && section !== 'Lead stories') return '';
  if (place.subsection === 'Armenia' && isAzerbaijaniOutlet(article)) return 'Azerbaijani outlet excluded from Armenia coverage';
  if (place.subsection === 'Azerbaijan' && isArmenianOutlet(article)) return 'Armenian outlet excluded from Azerbaijan coverage';
  return '';
}
