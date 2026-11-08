import { NEWS_SECTIONS, MISCELLANEOUS_COUNTRIES } from './newsSections.js';
import { preferredRegionalPlacement, sourceHomeCountry, ukraineAttackPlacement } from './storyPlacement.js';

const regional = NEWS_SECTIONS.slice(1, 5);
const regionalCountry = new Map(regional.flatMap(section => section.subsections.map(country => [country, section.id])));
const aliases = {
  'Albania': ['Albanian', 'Tirana'],
  'Bosnia and Herzegovina': ['Bosnia', 'Bosnian', 'Sarajevo', 'Banja Luka'],
  'Montenegro': ['Montenegrin', 'Podgorica'],
  'North Macedonia': ['Macedonian', 'Skopje'],
  'Serbia': ['Serbian', 'Belgrade'],
  'Serbia / Kosovo': ['Kosovo', 'Kosovar', 'Pristina', 'Prishtina'],
  'Belarus': ['Belarusian', 'Minsk'],
  'Moldova': ['Moldovan', 'Chisinau', 'Chișinău'],
  'Moldova / Transdniestria': ['Transdniestria', 'Transnistria', 'Tiraspol'],
  'Ukraine': ['Ukrainian', 'Kyiv', 'Kiev', 'Kharkiv', 'Odesa', 'Odessa', 'Lviv', 'Dnipro', 'Zaporizhzhia'],
  'Armenia': ['Armenian', 'Yerevan'],
  'Azerbaijan': ['Azerbaijani', 'Baku'],
  'Georgia': ['Georgian', 'Tbilisi'],
  'Georgia / Abkhazia / South Ossetia': ['Abkhazia', 'Abkhaz', 'South Ossetia', 'Tskhinvali', 'Sukhumi'],
  'Kazakhstan': ['Kazakh', 'Astana', 'Almaty'],
  'Kyrgyzstan': ['Kyrgyz', 'Bishkek'],
  'Tajikistan': ['Tajik', 'Dushanbe'],
  'Turkmenistan': ['Turkmen', 'Ashgabat'],
  'Uzbekistan': ['Uzbek', 'Tashkent'],
  'Austria': ['Austrian', 'Vienna'],
  'Belgium': ['Belgian', 'Brussels'],
  'Bulgaria': ['Bulgarian', 'Sofia'],
  'Croatia': ['Croatian', 'Zagreb'],
  'Cyprus': ['Cypriot', 'Nicosia'],
  'Czechia': ['Czech', 'Prague'],
  'Denmark': ['Danish', 'Copenhagen'],
  'Estonia': ['Estonian', 'Tallinn'],
  'Finland': ['Finnish', 'Helsinki'],
  'France': ['French', 'Paris'],
  'Germany': ['German', 'Berlin'],
  'Greece': ['Greek', 'Athens'],
  'Hungary': ['Hungarian', 'Budapest'],
  'Iceland': ['Icelandic', 'Reykjavik', 'Reykjavík'],
  'Ireland': ['Irish', 'Dublin'],
  'Italy': ['Italian', 'Rome'],
  'Latvia': ['Latvian', 'Riga'],
  'Lithuania': ['Lithuanian', 'Vilnius'],
  'Luxembourg': ['Luxembourgish'],
  'Malta': ['Maltese', 'Valletta'],
  'Netherlands': ['Dutch', 'Amsterdam', 'The Hague'],
  'Norway': ['Norwegian', 'Oslo'],
  'Poland': ['Polish', 'Warsaw', 'Krakow', 'Kraków'],
  'Portugal': ['Portuguese', 'Lisbon'],
  'Romania': ['Romanian', 'Bucharest'],
  'Slovakia': ['Slovak', 'Bratislava'],
  'Slovenia': ['Slovenian', 'Ljubljana'],
  'Spain': ['Spanish', 'Madrid'],
  'Sweden': ['Swedish', 'Stockholm'],
  'Switzerland': ['Swiss', 'Bern', 'Zurich'],
  'United Kingdom': ['UK', 'British', 'Britain', 'England', 'English', 'Scotland', 'Scottish', 'Wales', 'Welsh', 'London'],
  'Iran': ['Iranian', 'Tehran', 'Hormuz'],
  'Israel': ['Israeli', 'Palestinian', 'Palestine', 'Gaza', 'West Bank', 'Jerusalem', 'Tel Aviv'],
  'Jordan': ['Jordanian', 'Amman'],
  'Lebanon': ['Lebanese', 'Beirut'],
  'Libya': ['Libyan', 'Tripoli'],
  'Saudi Arabia': ['Saudi', 'Riyadh'],
  'Syria': ['Syrian', 'Damascus'],
  'Türkiye': ['Turkey', 'Turkish', 'Ankara', 'Istanbul'],
  'Yemen': ['Yemeni', 'Houthi', 'Sanaa', "Sana'a", 'Taiz', 'Aden'],
  'Russia': ['Russian', 'Moscow', 'Kremlin', 'St Petersburg'],
  'Afghanistan': ['Afghan', 'Kabul'],
  'China': ['Chinese', 'Beijing'],
  'Japan': ['Japanese', 'Tokyo'],
  'Mongolia': ['Mongolian', 'Ulaanbaatar'],
  'South Korea': ['Seoul', 'South Korean'],
  'North Korea': ['Pyongyang', 'North Korean'],
  'Australia': ['Australian', 'Canberra', 'Sydney', 'Melbourne'],
  'New Zealand': ['Kiwi', 'Wellington', 'Auckland'],
  'Canada': ['Canadian', 'Ottawa', 'Toronto'],
  'United States': ['US', 'U.S.', 'American', 'Washington', 'New York']
};
const regionAliases = new Map([
  ['europe', 'WESTERN / CENTRAL EUROPE'], ['westerncentraleurope', 'WESTERN / CENTRAL EUROPE'],
  ['middleeast', 'MIDDLE EAST / NORTH AFRICA'], ['middleeastnorthafrica', 'MIDDLE EAST / NORTH AFRICA'],
  ['eurasia', 'RUSSIA / EURASIA'], ['russiaeurasia', 'RUSSIA / EURASIA'],
  ['afghanistanpakistan', 'AFGHANISTAN / PAKISTAN'], ['northeastasia', 'NORTH EAST ASIA'],
  ['southpacific', 'SOUTH PACIFIC'], ['northamerica', 'NORTH AMERICA'],
  ['internationalorganisations', 'INTERNATIONAL ORGANISATIONS'], ['internationalorganizations', 'INTERNATIONAL ORGANISATIONS']
]);
const organisationAliases = [
  ['OSCE', /\bOSCE\b|Organization for Security and Co-operation in Europe|Organisation for Security and Co-operation in Europe/i],
  ['EU', /\bEU\b|European Union|European Commission|European Parliament/i],
  ['UN', /\bUN\b|United Nations/i],
  ['NATO', /\bNATO\b/i],
  ['IMF', /\bIMF\b|International Monetary Fund/i],
  ['ECB', /\bECB\b|European Central Bank/i]
];
const compact = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const escaped = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const matches = (text, phrase) => new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped(phrase)}(?=$|[^\\p{L}\\p{N}])`, 'iu').exec(text);
const countries = [
  ...regional.flatMap(section => section.subsections.map(country => ({ sectionId: section.id, subsection: country, country: '' }))),
  ...Object.entries(MISCELLANEOUS_COUNTRIES).filter(([subsection]) => subsection !== 'INTERNATIONAL ORGANISATIONS')
    .flatMap(([subsection, names]) => names.map(country => ({ sectionId: 'Miscellaneous', subsection, country }))),
  { sectionId: 'Miscellaneous', subsection: 'MIDDLE EAST / NORTH AFRICA', country: 'Yemen' }
];

function headlineLocation(title, row) {
  const region = compact(row.region);
  const preferredSection = regional.find(section => compact(section.id) === region)?.id;
  const preferredSubsection = regionAliases.get(region);
  const found = countries.flatMap(place => {
    const name = place.country || place.subsection;
    return [name, ...(aliases[name] || [])].flatMap((phrase, index) => {
      const match = matches(title, phrase);
      if (!match) return [];
      const regionBonus = place.sectionId === preferredSection || place.subsection === preferredSubsection ? 1 : 0;
      return [{ place, score: (index === 0 ? 3 : 2) + regionBonus, index: match.index }];
    });
  }).sort((a, b) => b.score - a.score || a.index - b.index);
  if (!found.length) return null;
  const home = sourceHomeCountry({ sourceName: row.source, url: row.url });
  const homeMatch = found.find(item => item.place.subsection === home && regionalCountry.has(home));
  if (homeMatch && new Set(found.filter(item => regionalCountry.has(item.place.subsection)).map(item => item.place.subsection)).size > 1) {
    return preferredRegionalPlacement({ title, url: row.url, sourceName: row.source }, homeMatch.place);
  }
  return found[0].place;
}

export function weekendPlacementForRow(row, suggested = {}) {
  const title = String(row.heading || '').trim();
  const attackedUkraine = ukraineAttackPlacement(title);
  if (attackedUkraine) return attackedUkraine;
  if (/\b(?:Abkhazia|Abkhaz|South Ossetia|Tskhinvali|Sukhumi)\b/i.test(title)) {
    return { sectionId: 'South Caucasus', subsection: 'Georgia / Abkhazia / South Ossetia', country: '' };
  }
  const location = headlineLocation(title, row);
  const organisation = organisationAliases.find(([, pattern]) => pattern.test(title));
  if (organisation && (!location || !matches(title, location.country || location.subsection))) {
    return { sectionId: 'Miscellaneous', subsection: 'INTERNATIONAL ORGANISATIONS', country: organisation[0] };
  }
  if (location) return location;
  if (suggested.sectionId && suggested.subsection) return suggested;
  const region = compact(row.region);
  const regionalSection = regional.find(section => compact(section.id) === region);
  if (regionalSection) return { sectionId: regionalSection.id, subsection: '', country: '' };
  const subsection = regionAliases.get(region);
  if (subsection) return { sectionId: 'Miscellaneous', subsection, country: '' };
  return { sectionId: 'Miscellaneous', subsection: '', country: '' };
}

export function resolveWeekendPlacementRows(rows, convert) {
  const first = convert(rows);
  if (!first.needsPlacement.length) return { ...first, autoPlaced: [], unplaced: [], policyBlocked: [] };
  const byNumber = new Map(rows.map(row => [row.rowNumber, row]));
  const autoPlaced = first.needsPlacement.map(item => ({ ...item, placement: weekendPlacementForRow(byNumber.get(item.row) || { heading: item.title, url: item.url }, item.suggested) }));
  const overrides = Object.fromEntries(autoPlaced.map(item => [item.row, item.placement]));
  const converted = convert(rows, { placementOverrides: overrides });
  const placedUrls = new Set(autoPlaced.map(item => item.url));
  return {
    ...converted,
    articles: converted.articles.map(article => placedUrls.has(article.url) ? { ...article, weekendAutoPlaced: true } : article),
    autoPlaced: autoPlaced.filter(item => converted.articles.some(article => article.url === item.url)),
    unplaced: converted.needsPlacement.filter(item => !item.reason),
    policyBlocked: converted.needsPlacement.filter(item => item.reason)
  };
}
