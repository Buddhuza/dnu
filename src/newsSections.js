export const NEWS_SECTIONS = [
  { id: 'Lead stories', subsections: ['Ukraine', 'Middle East'] },
  { id: 'South Eastern Europe', subsections: ['Albania', 'Bosnia and Herzegovina', 'Montenegro', 'North Macedonia', 'Serbia', 'Serbia / Kosovo'] },
  { id: 'Eastern Europe', subsections: ['Belarus', 'Moldova', 'Moldova / Transdniestria', 'Ukraine'] },
  { id: 'South Caucasus', subsections: ['Armenia', 'Azerbaijan', 'Georgia', 'Georgia / Abkhazia / South Ossetia'] },
  { id: 'Central Asia', subsections: ['Kazakhstan', 'Kyrgyzstan', 'Tajikistan', 'Turkmenistan', 'Uzbekistan'] },
  { id: 'Miscellaneous', subsections: ['WESTERN / CENTRAL EUROPE', 'MIDDLE EAST / NORTH AFRICA', 'RUSSIA / EURASIA', 'AFGHANISTAN / PAKISTAN', 'NORTH EAST ASIA', 'NORTH AMERICA', 'INTERNATIONAL ORGANISATIONS'] }
];

export function isSouthEasternEuropeRegionalStory(title) {
  const headline = String(title || '');
  return /\b(?:Western Balkans|South[\s-]*East(?:ern)?\s+Europe)\b/i.test(headline) &&
    !/\b(?:Albania|Albanian|Bosnia|Bosnian|Montenegro|Montenegrin|North Macedonia|Macedonian|Serbia|Serbian|Kosovo|Kosovar)\b/i.test(headline);
}

export function isMontenegroCroatiaDialogueStory(title, sourceName) {
  return /^MINA$/i.test(String(sourceName || '').trim()) && /\bCroatia\b/i.test(String(title || '')) &&
    /\b(?:outstanding issues|dialogue|bilateral relations)\b/i.test(String(title || ''));
}

export function isLithuanianBalticStory(title, summary, sourceName) {
  return /^LRT$/i.test(String(sourceName || '').trim()) && /\bBaltic states\b/i.test(String(title || '')) &&
    /\bLithuania\b/i.test(String(summary || ''));
}

export function isGreekPrimeMinisterStory(title) {
  return /^(?:EXCLUSIVE:\s*)?Greek\s+(?:PM|prime minister)\b/i.test(String(title || '').trim());
}

export const MISCELLANEOUS_COUNTRIES = {
  'WESTERN / CENTRAL EUROPE': ['Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czechia', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Norway', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Switzerland', 'United Kingdom'],
  'MIDDLE EAST / NORTH AFRICA': ['Iran', 'Israel', 'Jordan', 'Lebanon', 'Libya', 'Saudi Arabia', 'Syria', 'Türkiye'],
  'RUSSIA / EURASIA': ['Russia'],
  'AFGHANISTAN / PAKISTAN': ['Afghanistan'],
  'NORTH EAST ASIA': ['China', 'Japan', 'Mongolia', 'South Korea', 'North Korea'],
  'NORTH AMERICA': ['Canada', 'United States'],
  'INTERNATIONAL ORGANISATIONS': ['OSCE', 'EU', 'UN', 'NATO', 'IMF', 'G7', 'G20', 'ICC', 'WTO', 'CIS', 'CSTO', 'BRICS']
};

const organisationOrder = MISCELLANEOUS_COUNTRIES['INTERNATIONAL ORGANISATIONS'];
const eurasianOrganisation = /\b(?:CIS|CSTO|BRICS|SCO|EAEU|Eurasian|Shanghai Cooperation)\b/i;
const regionalSectionIds = new Set(NEWS_SECTIONS.slice(1, 5).map(section => section.id));
const regionalLeadCountries = new Set(NEWS_SECTIONS.slice(1, 5).flatMap(section => section.subsections));

export function compareCountryLabels(subsection, a, b) {
  const alphabetical = a.localeCompare(b, 'en', { sensitivity: 'base', ignorePunctuation: true });
  if (subsection !== 'INTERNATIONAL ORGANISATIONS') return alphabetical;
  const rank = name => {
    const index = organisationOrder.indexOf(name);
    if (index >= 0) return index < 9 ? index : 100 + index;
    return eurasianOrganisation.test(name) ? 200 : 50;
  };
  return rank(a) - rank(b) || alphabetical;
}

export function leadRegionalHeadings(articles, leadOrigins = {}) {
  return new Set(articles.filter(article => article.sectionId === 'Lead stories' && regionalSectionIds.has(leadOrigins[article.id]?.sectionId)).map(article => article.subsection));
}

export function orderedSubsections(section, labels, extraRegionalHeadings = []) {
  const visibleLabels = [...labels];
  if (section?.id === 'Lead stories') {
    const regional = new Set([...regionalLeadCountries, ...extraRegionalHeadings]);
    return visibleLabels.sort((a, b) => Number(!regional.has(a)) - Number(!regional.has(b)) || compareCountryLabels('', a, b));
  }
  const order = new Map((section?.subsections ?? []).map((label, index) => [label, index]));
  return visibleLabels.sort((a, b) => Number(a !== '') - Number(b !== '') || (order.get(a) ?? 999) - (order.get(b) ?? 999));
}
