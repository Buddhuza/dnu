export const NEWS_SECTIONS = [
  { id: 'Lead stories', subsections: ['Ukraine', 'Middle East'] },
  { id: 'South Eastern Europe', subsections: ['Albania', 'Bosnia and Herzegovina', 'Montenegro', 'North Macedonia', 'Serbia', 'Serbia / Kosovo'] },
  { id: 'Eastern Europe', subsections: ['Belarus', 'Moldova', 'Moldova / Transdniestria', 'Ukraine'] },
  { id: 'South Caucasus', subsections: ['Armenia', 'Azerbaijan', 'Georgia', 'Georgia / Abkhazia / South Ossetia'] },
  { id: 'Central Asia', subsections: ['Kazakhstan', 'Kyrgyzstan', 'Tajikistan', 'Turkmenistan', 'Uzbekistan'] },
  { id: 'Miscellaneous', subsections: ['WESTERN / CENTRAL EUROPE', 'MIDDLE EAST / NORTH AFRICA', 'RUSSIA / EURASIA', 'AFGHANISTAN / PAKISTAN', 'NORTH EAST ASIA', 'NORTH AMERICA', 'INTERNATIONAL ORGANISATIONS'] }
];

export const MISCELLANEOUS_COUNTRIES = {
  'WESTERN / CENTRAL EUROPE': ['Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czechia', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Norway', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Switzerland', 'United Kingdom'],
  'MIDDLE EAST / NORTH AFRICA': ['Iran', 'Israel', 'Lebanon', 'Libya', 'Saudi Arabia', 'Syria', 'Türkiye'],
  'RUSSIA / EURASIA': ['Russia'],
  'AFGHANISTAN / PAKISTAN': ['Afghanistan'],
  'NORTH EAST ASIA': ['China', 'Japan', 'Mongolia', 'South Korea', 'North Korea'],
  'NORTH AMERICA': ['Canada', 'United States'],
  'INTERNATIONAL ORGANISATIONS': ['OSCE', 'EU', 'NATO', 'UN', 'G7', 'G20', 'ICC', 'WTO', 'IMF', 'CIS', 'CSTO']
};

export const EDITORIAL_GUIDANCE = [
  'Any international news agency can supply stories in any report section. The source-list category is only for browsing outlets; place each article by the location or organisation it covers.',
  'Lead stories contain three or four major Ukraine headlines and one or two major Middle East headlines. Use Reuters, AP, AFP, DW, Politico, Euronews, BBC or dpa for Ukraine leads. Do not place Ukrainian outlets under Ukraine in any section; place an international organisation here only for an exceptional OSCE story.',
  'Use Serbia / Kosovo for Kosovo coverage and Moldova / Transdniestria for Transdniestria coverage. Use Georgia / Abkhazia / South Ossetia for Georgia’s breakaway republics.',
  'Use Armenian outlets for Armenia and Azerbaijani outlets for Azerbaijan, but do not place either country’s outlets under the other country. Keep each summary to one short sentence that adds a concrete fact from the first two paragraphs beyond the headline.',
  'When a story concerns several countries in South Eastern Europe, Eastern Europe, the South Caucasus or Central Asia, file it under the country of the reporting outlet if that country is one of the story subjects. Otherwise use the principal actor or subject; do not infer a country from a publisher name appended to the headline.',
  'Western / Central Europe includes Iceland and the UK, while Belarus, Moldova and Ukraine belong in Eastern Europe. Middle East / North Africa focuses especially on the Iran war and the Strait of Hormuz.',
  'Afghanistan / Pakistan is reserved for Afghanistan stories connected to Russia or Central Asian countries. Russia / Eurasia covers Russia only.',
  'North East Asia covers China, Japan, Mongolia and both Koreas. North America covers Canada and the US. International Organisations covers OSCE, EU institutions, NATO, UN bodies, G7, G20, ICC, WTO, IMF, CIS and CSTO.'
];

export function orderedSubsections(section, labels) {
  const order = new Map((section?.subsections ?? []).map((label, index) => [label, index]));
  const leadRank = label => section?.id === 'Lead stories' ? label === 'Ukraine' ? 0 : label === 'Middle East' ? 1 : (order.get(label) ?? 999) + 2 : order.get(label) ?? 999;
  return [...labels].sort((a, b) => leadRank(a) - leadRank(b));
}
