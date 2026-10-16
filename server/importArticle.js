import { NEWS_SECTIONS, MISCELLANEOUS_COUNTRIES } from '../src/newsSections.js';
import { excludedHeadlineReason } from '../src/headlinePolicy.js';
import { preferredRegionalPlacement } from '../src/storyPlacement.js';
import { viennaWallTimeToIso, wallTimeToIso } from '../src/viennaTime.js';
import { isEnglishArticle, isRussianSource, isRussiaFocused } from './editorialPolicy.js';

const sections = new Map(NEWS_SECTIONS.map(section => [section.id, new Set(section.subsections)]));
const western = ['Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czechia', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Norway', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Switzerland', 'United Kingdom', 'UK', 'Britain', 'England', 'Scotland', 'Wales'];
const countryRules = [
  ['South Eastern Europe', 'Serbia / Kosovo', /\bKosovo|Kosovar|Pristina|Prishtina\b/i],
  ['Eastern Europe', 'Moldova / Transdniestria', /\bTransdniestria|Transnistria\b/i],
  ['South Caucasus', 'Georgia / Abkhazia / South Ossetia', /\bAbkhazia|South Ossetia\b/i],
  ...[
    ['South Eastern Europe', ['Albania', 'Bosnia and Herzegovina', 'Montenegro', 'North Macedonia', 'Serbia']],
    ['Eastern Europe', ['Belarus', 'Moldova', 'Ukraine']],
    ['South Caucasus', ['Armenia', 'Azerbaijan', 'Georgia']],
    ['Central Asia', ['Kazakhstan', 'Kyrgyzstan', 'Tajikistan', 'Turkmenistan', 'Uzbekistan']]
  ].flatMap(([section, countries]) => countries.map(country => [section, country, new RegExp(`\\b(?:${country === 'Bosnia and Herzegovina' ? 'Bosnia|Bosnian|Herzegovina' : country === 'North Macedonia' ? 'North Macedonia|Macedonian' : country === 'Ukraine' ? 'Ukraine|Ukrainian|Kyiv' : country === 'Kyrgyzstan' ? 'Kyrgyzstan|Kyrgyz' : country === 'Kazakhstan' ? 'Kazakhstan|Kazakh' : country === 'Georgia' ? 'Georgia|Georgian|Tbilisi' : country})\\b`, 'i')]))
];
const miscellaneous = [
  ['MIDDLE EAST / NORTH AFRICA', 'Saudi Arabia', /\bSaudi Arabia|Saudi|Riyadh|Aramco\b/i],
  ['MIDDLE EAST / NORTH AFRICA', 'Iran', /\bIran|Iranian|Tehran|Hormuz\b/i],
  ['MIDDLE EAST / NORTH AFRICA', 'Israel', /\bIsrael|Israeli|Palestin|Gaza|West Bank\b/i],
  ['MIDDLE EAST / NORTH AFRICA', 'Lebanon', /\bLebanon|Lebanese|Beirut\b/i],
  ['MIDDLE EAST / NORTH AFRICA', 'Libya', /\bLibya|Libyan\b/i],
  ['MIDDLE EAST / NORTH AFRICA', 'Syria', /\bSyria|Syrian|Damascus\b/i],
  ['MIDDLE EAST / NORTH AFRICA', 'Türkiye', /\bT[üu]rki(?:ye|sh)|Ankara|Istanbul\b/i],
  ['RUSSIA / EURASIA', 'Russia', /\bRussia|Russian|Moscow|Kremlin|Putin\b/i],
  ['AFGHANISTAN / PAKISTAN', 'Afghanistan', /\bAfghanistan|Afghan|Kabul\b/i],
  ['NORTH EAST ASIA', 'China', /\bChina|Chinese|Beijing\b/i],
  ['NORTH EAST ASIA', 'Japan', /\bJapan|Japanese|Tokyo\b/i],
  ['NORTH EAST ASIA', 'Mongolia', /\bMongolia|Mongolian|Ulaanbaatar\b/i],
  ['NORTH EAST ASIA', 'South Korea', /\bSouth Korea|Seoul\b/i],
  ['NORTH EAST ASIA', 'North Korea', /\bNorth Korea|Pyongyang\b/i],
  ['NORTH AMERICA', 'Canada', /\bCanada|Canadian|Ottawa\b/i],
  ['NORTH AMERICA', 'United States', /\bUnited States|\bU\.S\.|\bUS\b|American|Washington|Trump\b/i]
];
const organisations = ['OSCE', 'EU', 'NATO', 'UN', 'G7', 'G20', 'ICC', 'WTO', 'IMF', 'CIS', 'CSTO'];
const miscCountries = new Map(Object.entries(MISCELLANEOUS_COUNTRIES).map(([label, names]) => [label, new Set(names)]));

export function publicArticleUrl(value) {
  try {
    const url = new URL(String(value));
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !host.includes('.') || host.endsWith('.local') || host.endsWith('.internal') || host === 'localhost' || /^[\d.]+$/.test(host) || host.includes(':') || url.href.length > 400) return null;
    return url;
  } catch { return null; }
}

export function sourceForArticle(url, sources) {
  const host = url.hostname.replace(/^www\./, '');
  return sources.find(source => { try { return new URL(source.url).hostname.replace(/^www\./, '') === host; } catch { return false; } }) || { id: 'manual', name: '', url: url.href };
}

function inferredPlacement(text) {
  for (const [sectionId, subsection, pattern] of countryRules) if (pattern.test(text)) return { sectionId, subsection, country: '' };
  for (const [subsection, country, pattern] of miscellaneous) if (pattern.test(text)) {
    if (subsection === 'AFGHANISTAN / PAKISTAN' && !/\bRussia|Russian|Central Asia|Kazakh|Kyrgyz|Tajik|Turkmen|Uzbek\b/i.test(text)) continue;
    return { sectionId: 'Miscellaneous', subsection, country };
  }
  const westernMatch = western.map(country => ({ country, index: text.search(new RegExp(`\\b${country}\\b`, 'i')) })).filter(item => item.index >= 0).sort((a, b) => a.index - b.index)[0];
  if (westernMatch) return { sectionId: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: ['UK', 'Britain', 'England', 'Scotland', 'Wales'].includes(westernMatch.country) ? 'United Kingdom' : westernMatch.country };
  for (const organisation of organisations) if (new RegExp(`\\b${organisation}\\b`, 'i').test(text)) return { sectionId: 'Miscellaneous', subsection: 'INTERNATIONAL ORGANISATIONS', country: organisation };
  return null;
}

export function articlePlacement(extracted, title, summary) {
  extracted = extracted?.classification && typeof extracted.classification === 'object' ? extracted.classification : extracted;
  const sectionId = String(extracted.section ?? '').trim();
  const subsection = String(extracted.subsection ?? '').trim();
  const country = String(extracted.country ?? '').trim();
  if (sectionId !== 'Lead stories' && sections.get(sectionId)?.has(subsection) && (sectionId !== 'Miscellaneous' || miscCountries.get(subsection)?.has(country))) return { sectionId, subsection, country: sectionId === 'Miscellaneous' ? country : '' };
  return inferredPlacement(title) || inferredPlacement(`${title} ${summary}`);
}

export function publicationTimestamp(...values) {
  const abbreviations = { UTC: 'Z', GMT: 'Z', CET: '+01:00', CEST: '+02:00', EET: '+02:00', EEST: '+03:00', BST: '+01:00', EST: '-05:00', EDT: '-04:00', CST: '-06:00', CDT: '-05:00', MST: '-07:00', MDT: '-06:00', PST: '-08:00', PDT: '-07:00' };
  for (const value of values) {
    if (typeof value !== 'string') continue;
    let normalized = value.trim().replace(/^(\d{4}-\d{2}-\d{2})(UTC|GMT|CET|CEST|EET|EEST|BST|EST|EDT|CST|CDT|MST|MDT|PST|PDT)(\d{2}:\d{2}(?::\d{2})?)$/i, (_, date, zone, time) => `${date}T${time}${abbreviations[zone.toUpperCase()]}`).replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/, '$1T$2').replace(/\s+([+-]\d{2}:?\d{2})$/, '$1');
    normalized = normalized.replace(/\s+(UTC|GMT|CET|CEST|EET|EEST|BST|EST|EDT|CST|CDT|MST|MDT|PST|PDT)$/i, (_, zone) => abbreviations[zone.toUpperCase()]);
    normalized = normalized.replace(/\s+GMT([+-])(\d{1,2})(?::?(\d{2}))?$/i, (_, sign, hours, minutes) => `${sign}${hours.padStart(2, '0')}:${minutes || '00'}`);
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) && Number.isFinite(Date.parse(normalized))) return new Date(normalized).toISOString();
    const natural = value.trim().replace(/\s+at\s+/i, ' ').replace(/\s+(UTC|GMT|CET|CEST|EET|EEST|BST|EST|EDT|CST|CDT|MST|MDT|PST|PDT)$/i, (_, zone) => ` ${abbreviations[zone.toUpperCase()]}`);
    if (/\b20\d{2}\b/.test(natural) && /\b\d{1,2}:\d{2}\b/.test(natural) && /(?:Z|[+-]\d{2}:?\d{2}|GMT[+-]\d{1,2})$/i.test(natural) && /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(natural) && Number.isFinite(Date.parse(natural))) return new Date(natural).toISOString();
    const namedZone = value.trim().match(/^(20\d{2})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?\s+(?:([A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?)|(ET|CT|PT))$/i);
    if (namedZone) {
      const zone = namedZone[7] || ({ ET: 'America/New_York', CT: 'America/Chicago', PT: 'America/Los_Angeles' })[namedZone[8].toUpperCase()];
      const iso = wallTimeToIso(zone, Number(namedZone[1]), Number(namedZone[2]), Number(namedZone[3]), Number(namedZone[4]), Number(namedZone[5]), Number(namedZone[6] || 0));
      if (iso) return iso;
    }
  }
  return null;
}

const monthNumbers = new Map('jan feb mar apr may jun jul aug sep oct nov dec'.split(' ').map((month, index) => [month, index + 1]));

function inferredDateTime(value, requireTime = false) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const numeric = text.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?\b/);
  if (numeric && (!requireTime || numeric[4] !== undefined)) return viennaWallTimeToIso(Number(numeric[1]), Number(numeric[2]), Number(numeric[3]), numeric[4] === undefined ? 12 : Number(numeric[4]), Number(numeric[5] || 0), Number(numeric[6] || 0));
  const monthFirst = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2}),?\s+(20\d{2})(?:\s*(?:at|,)?\s*(\d{1,2}):(\d{2})\s*(am|pm)?)?/i);
  const dayFirst = text.match(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(20\d{2})(?:\s*(?:at|,)?\s*(\d{1,2}):(\d{2})\s*(am|pm)?)?/i);
  const match = monthFirst || dayFirst;
  if (!match || (requireTime && match[4] === undefined)) return null;
  const month = monthNumbers.get(String(monthFirst ? match[1] : match[2]).slice(0, 3).toLowerCase());
  let hour = Number(match[4] || 12);
  const suffix = String(match[6] || '').toLowerCase();
  if (suffix === 'pm' && hour < 12) hour += 12;
  if (suffix === 'am' && hour === 12) hour = 0;
  return viennaWallTimeToIso(Number(match[3]), month, Number(monthFirst ? match[2] : match[1]), hour, Number(match[5] || 0));
}

function relativeTime(value, now) {
  if (typeof value !== 'string') return null;
  const match = value.match(/\b(?:published|posted|updated)?\s*(\d{1,3})\s+(minute|hour|day)s?\s+ago\b/i);
  if (!match) return null;
  const minutes = Number(match[1]) * ({ minute: 1, hour: 60, day: 1440 })[match[2].toLowerCase()];
  return new Date(now - minutes * 60000).toISOString();
}

export function resolveArticleTime(payload, url, now = Date.now()) {
  const data = payload?.data ?? {};
  const metadata = data.metadata ?? {};
  const extracted = typeof data.json === 'string' ? JSON.parse(data.json) : data.json ?? {};
  const html = String(data.html ?? '');
  const pageValues = [metadata.publishedTime, metadata['article:published_time'], metadata['date.available'], metadata['date.created'], ...[...html.matchAll(/["']datePublished["']\s*:\s*["']([^"']+)/gi)].map(match => match[1]), ...[...html.matchAll(/<time\b[^>]*\bdatetime=["']([^"']+)/gi)].map(match => match[1])];
  const pageTime = publicationTimestamp(...pageValues);
  if (pageTime) return { publishedAt: pageTime, timeSource: 'page' };
  const extractedTime = publicationTimestamp(extracted.publishedAt, extracted.datePublished);
  if (extractedTime) return { publishedAt: extractedTime, timeSource: 'inferred' };
  const clueTime = publicationTimestamp(extracted.publicationClue);
  if (clueTime) return { publishedAt: clueTime, timeSource: 'inferred' };
  const markdown = String(data.markdown ?? '').slice(0, 1200);
  const candidates = [...pageValues, extracted.publishedAt, extracted.datePublished, extracted.publicationClue, metadata.description, markdown, url.pathname];
  for (const candidate of candidates) {
    const inferred = inferredDateTime(candidate, true);
    if (inferred) return { publishedAt: inferred, timeSource: 'inferred' };
    const relative = relativeTime(candidate, now);
    if (relative) return { publishedAt: relative, timeSource: 'inferred' };
  }
  for (const candidate of [...candidates.slice(0, -2), url.pathname, metadata.description, markdown]) {
    const inferred = inferredDateTime(candidate);
    if (inferred) return { publishedAt: inferred, timeSource: 'inferred' };
  }
  return { publishedAt: new Date(now).toISOString(), timeSource: 'current' };
}

export function importedArticle(payload, url, source, { allowUnplaced = false } = {}) {
  const data = payload?.data ?? {};
  const extracted = typeof data.json === 'string' ? JSON.parse(data.json) : data.json ?? {};
  const title = String(data.metadata?.ogTitle ?? extracted.exactHeadline ?? data.metadata?.title ?? '').trim();
  const summary = String(extracted.summary ?? '').trim();
  if (!title || !summary) throw new Error('The original page did not yield a headline and a one-sentence summary.');
  if (excludedHeadlineReason(title)) throw new Error(excludedHeadlineReason(title));
  if (!isEnglishArticle(payload, title, summary)) throw new Error('The original article is not in English.');
  const { publishedAt, timeSource } = resolveArticleTime(payload, url);
  if (isRussianSource(source) && !isRussiaFocused(title, summary)) throw new Error('Russian outlets are limited to Russia-focused stories.');
  let placement = articlePlacement(extracted, title, summary);
  if (placement) placement = preferredRegionalPlacement({ ...source, sourceId: source.id, title, summary, url: url.href }, placement);
  if (!placement && !allowUnplaced) throw new Error('The article could not be placed in a configured country or organisation.');
  if (isRussianSource(source) && placement && (placement.sectionId !== 'Miscellaneous' || placement.subsection !== 'RUSSIA / EURASIA')) {
    if (!allowUnplaced) throw new Error('Russian outlets are limited to the Russia section.');
    placement = { sectionId: 'Miscellaneous', subsection: 'RUSSIA / EURASIA', country: 'Russia' };
  }
  const agency = String(source.agencyName || source.name || data.metadata?.ogSiteName || data.metadata?.siteName || url.hostname).trim();
  return { id: `manual-${url.href}`, url: url.href, sourceId: 'manual', sourceName: agency, title, summary, publishedAt, timeSource, reviewed: true, hidden: false, russianSource: isRussianSource(source), ...(placement || { sectionId: '', subsection: '', country: '' }) };
}
