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
const internationalOutlets = /^(?:Reuters|AP|AP News|Associated Press|AFP|Agence France-Presse|BBC(?: News)?|DW|Deutsche Welle|dpa|Politico(?:\.eu| Europe)?|Euronews|France 24|Al Jazeera|CNN|The Guardian|Guardian|Financial Times|FT|RFE\/RL|VOA|Bloomberg|PBS|NBC News|ABC News|CBS News|NPR|The New York Times|The Washington Post)$/i;
const localFrenchOutlets = /^(?:Le Monde|Le Figaro|Libération|France Info|Franceinfo|RFI|Local\.fr)$/i;
const localGermanOutlets = /^(?:Der Spiegel|Spiegel|Die Zeit|Süddeutsche Zeitung|FAZ|Tagesschau|Local\.de)$/i;
const localUsOutlets = /^(?:USA Today|Axios|The Hill|Defense News|Defense One|Military Times|Breaking Defense|Stars and Stripes|C-SPAN|Fox(?: News)?)$/i;
const internationalSourceIds = new Set(['source-79', 'source-80', 'source-81', 'source-82', 'source-83', 'source-84', 'source-85', 'source-86', 'source-87', 'source-101', 'source-106', 'source-122', 'source-153', 'source-154', 'source-155', 'source-156', 'source-165']);

export function isInternationalOutlet(article) {
  if (!article.sourceName && !article.sourceId && !article.url) return true;
  return internationalSourceIds.has(article.sourceId) || internationalOutlets.test(String(article.sourceName || '').trim()) || ['apnews.com', 'theguardian.com', 'reuters.com', 'bbc.com', 'bbc.co.uk'].some(host => sourceHost(article) === host || sourceHost(article).endsWith(`.${host}`));
}

function sourceHost(article) {
  try { return new URL(article.url).hostname.replace(/^www\./, '').toLowerCase(); }
  catch { return ''; }
}

export function directGovernmentPublicationReason(article) {
  const name = String(article.sourceName || '').trim();
  const host = sourceHost(article);
  if (/^osce\.org$/i.test(name) || /(?:^|\.)osce\.org$/i.test(host)) return 'Direct OSCE publication';
  if (/^president\.uz$/i.test(name) || /(?:^|\.)president\.uz$/i.test(host)) return 'Direct presidential publication';
  if (/^(?:World Bank|International Bank for Reconstruction and Development)$/i.test(name) || /(?:^|\.)worldbank\.org$/i.test(host)) return 'Direct organisation publication';
  if (/^(?:GOV\.UK|government of\b|ministry of\b|office of the president\b|presidency\b|prime minister(?:'s|’s)? office\b|white house\b|president of\b)/i.test(name) ||
      /\bgovernment$/i.test(name) ||
      /(?:^|\.)(?:gov|gob|gouv|go)\.[a-z]{2,3}$/i.test(host) ||
      /(?:^|\.)gov$/i.test(host)) return 'Direct government publication';
  return '';
}

export function paywalledSourceReason(article) {
  return /^Bloomberg$/i.test(String(article.sourceName || '').trim()) || /(?:^|\.)bloomberg\.com$/i.test(sourceHost(article))
    ? 'Bloomberg article is paywalled' : '';
}

export function unattributedRepublisherReason(article) {
  return /^Yahoo(?: News|\.com)?$/i.test(String(article.sourceName || '').trim())
    ? 'Yahoo republication without a verified original agency' : '';
}

export function isUkrainianOutlet(article) {
  if (ukrainianSourceIds.has(article.sourceId)) return true;
  const hostname = sourceHost(article);
  return hostname.endsWith('.ua') || [...ukrainianHosts].some(host => hostname === host || hostname.endsWith(`.${host}`));
}

export function isArmenianOutlet(article) {
  const hostname = sourceHost(article);
  return armenianSourceIds.has(article.sourceId) || hostname.endsWith('.am') || armenianHosts.has(hostname) || /^(?:Armenpress|PAN|Pan Armenian|News\.am|Armenia Liberty)$/i.test(String(article.sourceName || '').trim());
}

export function isAzerbaijaniOutlet(article) {
  return azerbaijaniSourceIds.has(article.sourceId) || sourceHost(article).endsWith('.az') || /^(?:APA|Azernews|News\.az|Azertac|Trend)$/i.test(String(article.sourceName || '').trim());
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
  if (isUkrainePlacement(place) && !isInternationalOutlet(article)) return 'Ukraine coverage requires an international news source';
  const section = place.sectionId || place.section;
  if (isRussianOutlet(article) && (section !== 'Miscellaneous' || place.subsection !== 'RUSSIA / EURASIA' || place.country !== 'Russia')) return 'Russian outlet restricted to Russia';
  if ((section === 'Miscellaneous' && place.subsection === 'RUSSIA / EURASIA' && place.country === 'Russia' || section === 'Lead stories' && place.subsection === 'Russia') && !isRussianOutlet(article) && !isInternationalOutlet(article)) return 'Russia coverage requires an international or Russian news source';
  if ((section === 'Miscellaneous' && place.subsection === 'WESTERN / CENTRAL EUROPE' && place.country === 'France' || section === 'Lead stories' && place.subsection === 'France') && !isInternationalOutlet(article) && !localFrenchOutlets.test(String(article.sourceName || '').trim())) return 'France coverage requires an international or French news source';
  if ((section === 'Miscellaneous' && place.subsection === 'WESTERN / CENTRAL EUROPE' && place.country === 'Germany' || section === 'Lead stories' && place.subsection === 'Germany') && !isInternationalOutlet(article) && !localGermanOutlets.test(String(article.sourceName || '').trim())) return 'Germany coverage requires an international or German news source';
  if ((section === 'Miscellaneous' && place.subsection === 'NORTH AMERICA' && ['United States', 'US'].includes(place.country) || section === 'Lead stories' && ['United States', 'US'].includes(place.subsection)) && !isInternationalOutlet(article) && !localUsOutlets.test(String(article.sourceName || '').trim())) return 'US coverage requires an international or US news source';
  if (section !== 'South Caucasus' && section !== 'Lead stories') return '';
  if (place.subsection === 'Armenia' && isAzerbaijaniOutlet(article)) return 'Azerbaijani outlet excluded from Armenia coverage';
  if (place.subsection === 'Azerbaijan' && isArmenianOutlet(article)) return 'Armenian outlet excluded from Azerbaijan coverage';
  return '';
}
