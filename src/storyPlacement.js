const regionalSections = new Set(['South Eastern Europe', 'Eastern Europe', 'South Caucasus', 'Central Asia']);

// An attack on Ukraine belongs under the place attacked, even when Russia is
// named first in the headline. Keep attacks launched from Ukraine against
// Russian territory out of this rule.
export function ukraineAttackPlacement(title, summary = '') {
  const text = `${title} ${summary}`;
  const ukrainianPlace = '(?:Ukraine|Ukrainian (?:cities|towns|villages|territory|infrastructure)|Kyiv|Kiev|Kharkiv|Odesa|Odessa|Dnipro|Lviv|Zaporizhzhia|Sumy|Chernihiv|Mykolaiv|Oleshky|Kramatorsk|Zhytomyr|Kryvyi Rih|Kherson|Poltava|Vinnytsia|Ternopil|Uman|Rivne|Cherkasy|Sloviansk|Pokrovsk)';
  const attack = '(?:attack\\w*|strik\\w*|bomb\\w*|shell\\w*|hit|hits|target\\w*|pound\\w*|kill\\w*|injur\\w*|launch\\w* (?:missiles|drones))';
  const patterns = [
    new RegExp(`\\b(?:Russia|Russian)\\b.{0,90}\\b${attack}\\b.{0,90}\\b${ukrainianPlace}\\b`, 'i'),
    new RegExp(`\\b${attack}\\b.{0,60}\\b(?:in|on|across|against|near|inside)\\s+(?:the\\s+)?${ukrainianPlace}\\b`, 'i'),
    new RegExp(`\\b${ukrainianPlace}\\b.{0,60}\\b(?:is|was|were|has been|have been)\\s+${attack}\\b`, 'i')
  ];
  return patterns.some(pattern => pattern.test(text)) ? { sectionId: 'Eastern Europe', subsection: 'Ukraine', country: '' } : null;
}

export function russianTerritoryAttackPlacement(title) {
  if (/\b(?:St\.? Petersburg|Leningrad|Moscow|Belgorod|Kursk|Bryansk|Voronezh|Rostov)\b/i.test(title)
    && /\b(?:drones?|missiles?|oil (?:facilit\w*|site\w*|terminal\w*)|blaze|ablaze|strik\w*|struck|attack\w*)\b/i.test(title)) {
    return { sectionId: 'Miscellaneous', subsection: 'RUSSIA / EURASIA', country: 'Russia' };
  }
  return null;
}

const countryMentions = [
  ['Albania', /\b(?:Albania|Albanian|Tirana)\b/i],
  ['Bosnia and Herzegovina', /\b(?:Bosnia|Bosnian|Herzegovina|Sarajevo)\b/i],
  ['Montenegro', /\b(?:Montenegro|Montenegrin|Podgorica)\b/i],
  ['North Macedonia', /\b(?:North Macedonia|Macedonian|Skopje)\b/i],
  ['Serbia / Kosovo', /\b(?:Kosovo|Kosovar|Pristina|Prishtina|Kurti|Konjufca)\b/i],
  ['Serbia', /\b(?:Serbia|Serbian|Belgrade|Vučić|Vucic)\b/i],
  ['Belarus', /\b(?:Belarus|Belarusian|Minsk|Lukashenko)\b/i],
  ['Moldova / Transdniestria', /\b(?:Transdniestria|Transnistria)\b/i],
  ['Moldova', /\b(?:Moldova|Moldovan|Chișinău|Chisinau)\b/i],
  ['Ukraine', /\b(?:Ukraine|Ukrainian|Kyiv|Zelenskyy|Zelensky)\b/i],
  ['Armenia', /\b(?:Armenia|Armenian|Yerevan|Pashinyan|Pashinian|Mirzoyan)\b/i],
  ['Azerbaijan', /\b(?:Azerbaijan|Azerbaijani|Baku|Aliyev)\b/i],
  ['Georgia / Abkhazia / South Ossetia', /\b(?:Abkhazia|Abkhaz|South Ossetia)\b/i],
  ['Georgia', /\b(?:Georgia|Georgian|Tbilisi)\b/i],
  ['Kazakhstan', /\b(?:Kazakhstan|Kazakh|Astana|Tokayev)\b/i],
  ['Kyrgyzstan', /\b(?:Kyrgyzstan|Kyrgyz|Bishkek|Japarov|Zhaparov)\b/i],
  ['Tajikistan', /\b(?:Tajikistan|Tajik|Dushanbe|Rahmon)\b/i],
  ['Turkmenistan', /\b(?:Turkmenistan|Turkmen|Ashgabat)\b/i],
  ['Uzbekistan', /\b(?:Uzbekistan|Uzbek|Tashkent|Mirziyoyev)\b/i]
];

const countrySection = new Map([
  ...['Albania', 'Bosnia and Herzegovina', 'Montenegro', 'North Macedonia', 'Serbia', 'Serbia / Kosovo'].map(country => [country, 'South Eastern Europe']),
  ...['Belarus', 'Moldova', 'Moldova / Transdniestria', 'Ukraine'].map(country => [country, 'Eastern Europe']),
  ...['Armenia', 'Azerbaijan', 'Georgia', 'Georgia / Abkhazia / South Ossetia'].map(country => [country, 'South Caucasus']),
  ...['Kazakhstan', 'Kyrgyzstan', 'Tajikistan', 'Turkmenistan', 'Uzbekistan'].map(country => [country, 'Central Asia'])
]);

const sourceHomes = new Map([
  ...[4, 5, 6, 7, 24].map(id => [`source-${id}`, 'Albania']),
  ...[8, 9, 23].map(id => [`source-${id}`, 'Bosnia and Herzegovina']),
  ...[10, 11, 12].map(id => [`source-${id}`, 'Montenegro']),
  ...[13, 14, 15, 16].map(id => [`source-${id}`, 'North Macedonia']),
  ...[17, 18, 19].map(id => [`source-${id}`, 'Serbia']),
  ...[20, 21, 22, 25].map(id => [`source-${id}`, 'Serbia / Kosovo']),
  ...[26, 27, 28, 29].map(id => [`source-${id}`, 'Belarus']),
  ...[30, 31, 32].map(id => [`source-${id}`, 'Moldova']),
  ...Array.from({ length: 13 }, (_, index) => [`source-${index + 33}`, 'Ukraine']),
  ...Array.from({ length: 9 }, (_, index) => [`source-${index + 46}`, 'Armenia']),
  ...Array.from({ length: 6 }, (_, index) => [`source-${index + 55}`, 'Azerbaijan']),
  ...[61, 62, 63, 64].map(id => [`source-${id}`, 'Georgia']),
  ['source-67', 'Azerbaijan'],
  ...[69, 70, 71, 72, 73].map(id => [`source-${id}`, 'Kazakhstan']),
  ...[74, 75, 76].map(id => [`source-${id}`, 'Kyrgyzstan']),
  ['source-77', 'Tajikistan'],
  ['source-78', 'Uzbekistan']
]);

const hostHomes = [
  [/\.al$/, 'Albania'], [/\.ba$/, 'Bosnia and Herzegovina'], [/\.me$/, 'Montenegro'],
  [/\.mk$/, 'North Macedonia'], [/\.rs$/, 'Serbia'], [/\.by$/, 'Belarus'],
  [/\.md$/, 'Moldova'], [/\.ua$/, 'Ukraine'], [/\.am$/, 'Armenia'],
  [/\.az$/, 'Azerbaijan'], [/\.ge$/, 'Georgia'], [/\.kz$/, 'Kazakhstan'],
  [/\.kg$/, 'Kyrgyzstan'], [/\.tj$/, 'Tajikistan'], [/\.uz$/, 'Uzbekistan']
];

export function sourceHomeCountry(article) {
  if (sourceHomes.has(article.sourceId)) return sourceHomes.get(article.sourceId);
  try {
    const hostname = new URL(article.url).hostname.replace(/^www\./, '').toLowerCase();
    if (hostname === 'pan.am' || hostname.endsWith('.pan.am')) return 'Armenia';
    if (hostname === 'arminfo.info' || hostname.endsWith('.arminfo.info')) return 'Armenia';
    if (hostname === 'kyivpost.com' || hostname.endsWith('.kyivpost.com') || hostname === 'kyivindependent.com') return 'Ukraine';
    return hostHomes.find(([pattern]) => pattern.test(hostname))?.[1] || '';
  } catch { return ''; }
}

export function preferredRegionalPlacement(article, placement) {
  const sectionId = placement?.sectionId || placement?.section;
  if (!regionalSections.has(sectionId)) return placement;
  const home = sourceHomeCountry(article);
  if (!home || home === 'Ukraine' || !countrySection.has(home)) return placement;
  const title = String(article.title || '').replace(/\s[-–|]\sEuronews Albania\s*$/i, '');
  const text = `${title} ${article.summary || ''}`;
  const mentioned = new Set(countryMentions.filter(([, pattern]) => pattern.test(text)).map(([country]) => country));
  if (mentioned.has('Serbia / Kosovo')) mentioned.delete('Serbia');
  if (mentioned.has('Moldova / Transdniestria')) mentioned.delete('Moldova');
  if (mentioned.has('Georgia / Abkhazia / South Ossetia')) mentioned.delete('Georgia');
  if (mentioned.size < 2 || !mentioned.has(home)) return placement;
  return { sectionId: countrySection.get(home), subsection: home, country: '' };
}
