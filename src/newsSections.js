export const NEWS_SECTIONS = [
  { id: 'Lead stories', subsections: ['Ukraine', 'Middle East'] },
  { id: 'South Eastern Europe', subsections: ['Albania', 'Bosnia and Herzegovina', 'Montenegro', 'North Macedonia', 'Serbia', 'Serbia / Kosovo'] },
  { id: 'Eastern Europe', subsections: ['Belarus', 'Moldova', 'Moldova / Transdniestria', 'Ukraine'] },
  { id: 'South Caucasus', subsections: ['Armenia', 'Azerbaijan', 'Georgia', 'Georgia / Abkhazia / South Ossetia'] },
  { id: 'Central Asia', subsections: ['Kazakhstan', 'Kyrgyzstan', 'Tajikistan', 'Turkmenistan', 'Uzbekistan'] },
  { id: 'Miscellaneous', subsections: ['WESTERN / CENTRAL EUROPE', 'MIDDLE EAST / NORTH AFRICA', 'RUSSIA / EURASIA', 'AFGHANISTAN / PAKISTAN', 'NORTH EAST ASIA', 'NORTH AMERICA', 'INTERNATIONAL ORGANISATIONS'] }
];

export const EDITORIAL_GUIDANCE = [
  'Any international news agency can supply stories in any report section. The source-list category is only for browsing outlets; place each article by the location or organisation it covers.',
  'Lead stories contain three or four major Ukraine headlines and one or two major Middle East headlines. Prefer Reuters, AP, AFP, DW, Politico, Euronews, BBC or dpa for Ukraine leads; place an international organisation here only for an exceptional OSCE story.',
  'Use Serbia / Kosovo for Kosovo coverage and Moldova / Transdniestria for Transdniestria coverage. Use Georgia / Abkhazia / South Ossetia for Georgia’s breakaway republics.',
  'Western / Central Europe includes Iceland and the UK, while Belarus, Moldova and Ukraine belong in Eastern Europe. Middle East / North Africa focuses especially on the Iran war and the Strait of Hormuz.',
  'Afghanistan / Pakistan is reserved for Afghanistan stories connected to Russia or Central Asian countries. Russia / Eurasia covers Russia only.',
  'North East Asia covers China, Japan, Mongolia and both Koreas. North America covers Canada and the US. International Organisations covers OSCE, EU institutions, NATO, UN bodies, G7, G20, ICC, WTO, IMF, CIS and CSTO.'
];

export function orderedSubsections(section, labels) {
  const order = new Map((section?.subsections ?? []).map((label, index) => [label, index]));
  return [...labels].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
}
