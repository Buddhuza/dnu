const ukrainianSourceIds = new Set(Array.from({ length: 13 }, (_, index) => `source-${index + 33}`));
const ukrainianHosts = new Set([
  'interfax.com.ua', 'ukrinform.net', 'newsukraine.rbc.ua', 'pravda.com.ua',
  'kyivpost.com', 'hromadske.ua', 'kyivindependent.com', 'nikvesti.com',
  'khpg.org', 'ukranews.com', 'unn.ua', 'euromaidanpress.com', 'tsn.ua'
]);
const armenianSourceIds = new Set(Array.from({ length: 9 }, (_, index) => `source-${index + 46}`));
const azerbaijaniSourceIds = new Set(Array.from({ length: 6 }, (_, index) => `source-${index + 55}`));
const armenianHosts = new Set(['arminfo.info']);
const russianSourceIds = new Set(['source-97', 'source-98', 'source-99', 'source-115', 'source-116']);
const russianHosts = new Set(['tass.com', 'iz.ru', 'sputniknews.com', 'sputnikglobe.com', 'themoscowtimes.com', 'meduza.io']);

function sourceHost(article) {
  try { return new URL(article.url).hostname.replace(/^www\./, '').toLowerCase(); }
  catch { return ''; }
}

export function directGovernmentPublicationReason(article) {
  const name = String(article.sourceName || '').trim();
  const host = sourceHost(article);
  if (/^(?:GOV\.UK|government of\b|ministry of\b|office of the president\b|presidency\b|prime minister(?:'s|’s)? office\b|white house\b|president of\b)/i.test(name) ||
      /\bgovernment$/i.test(name) ||
      /(?:^|\.)(?:gov|gob|gouv|go)\.[a-z]{2,3}$/i.test(host) ||
      /(?:^|\.)gov$/i.test(host)) return 'Direct government publication';
  return '';
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

export function isRussianOutlet(article) {
  const host = sourceHost(article);
  return article.russianSource === true || russianSourceIds.has(article.sourceId) || [...russianHosts].some(value => host === value || host.endsWith(`.${value}`));
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
  if (isRussianOutlet(article) && (section !== 'Miscellaneous' || place.subsection !== 'RUSSIA / EURASIA' || place.country !== 'Russia')) return 'Russian outlet restricted to Russia';
  if (isUkrainePlacement(place) && (isAzerbaijaniOutlet(article) || article.sourceId === 'source-68')) return 'Azerbaijani or TCA outlet excluded from Ukraine coverage';
  if (section === 'Miscellaneous' && place.subsection === 'RUSSIA / EURASIA' && place.country === 'Russia' && (isUkrainianOutlet(article) || article.sourceId === 'source-32' || isArmenianOutlet(article))) return 'Ukrainian, Moldovan or Armenian outlet excluded from Russia coverage';
  if (section === 'Miscellaneous' && place.subsection === 'WESTERN / CENTRAL EUROPE' && place.country === 'Germany' && article.sourceId === 'source-38') return 'Hromadske excluded from Germany coverage';
  if (section === 'Miscellaneous' && place.subsection === 'NORTH AMERICA' && place.country === 'United States' && (article.sourceId === 'source-103' || isAzerbaijaniOutlet(article))) return 'Yonhap or Azerbaijani outlet excluded from US coverage';
  if (section !== 'South Caucasus' && section !== 'Lead stories') return '';
  if (place.subsection === 'Armenia' && isAzerbaijaniOutlet(article)) return 'Azerbaijani outlet excluded from Armenia coverage';
  if (place.subsection === 'Azerbaijan' && isArmenianOutlet(article)) return 'Armenian outlet excluded from Azerbaijan coverage';
  return '';
}
