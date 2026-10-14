import { NEWS_SECTIONS } from '../src/newsSections.js';
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
const miscCountries = new Map([
  ['WESTERN / CENTRAL EUROPE', western.filter(country => !['UK', 'Britain', 'England', 'Scotland', 'Wales'].includes(country))],
  ['MIDDLE EAST / NORTH AFRICA', ['Iran', 'Israel', 'Lebanon', 'Libya', 'Syria', 'Türkiye']],
  ['RUSSIA / EURASIA', ['Russia']],
  ['AFGHANISTAN / PAKISTAN', ['Afghanistan']],
  ['NORTH EAST ASIA', ['China', 'Japan', 'Mongolia', 'South Korea', 'North Korea']],
  ['NORTH AMERICA', ['Canada', 'United States']],
  ['INTERNATIONAL ORGANISATIONS', organisations]
].map(([label, names]) => [label, new Set(names)]));

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
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const normalized = value.trim().replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/, '$1T$2').replace(/\s+([+-]\d{2}:?\d{2})$/, '$1');
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) && Number.isFinite(Date.parse(normalized))) return new Date(normalized).toISOString();
  }
  return null;
}

export function importedArticle(payload, url, source) {
  const data = payload?.data ?? {};
  const extracted = typeof data.json === 'string' ? JSON.parse(data.json) : data.json ?? {};
  const title = String(data.metadata?.ogTitle ?? extracted.exactHeadline ?? data.metadata?.title ?? '').trim();
  const summary = String(extracted.summary ?? '').trim();
  if (!title || !summary) throw new Error('The original page did not yield a headline and a one-sentence summary.');
  if (!isEnglishArticle(payload, title, summary)) throw new Error('The original article is not in English.');
  const publishedAt = publicationTimestamp(data.metadata?.publishedTime, extracted.publishedAt, data.metadata?.['article:published_time'], data.metadata?.['date.available'], data.html?.match(/<time[^>]+datetime=["']([^"']+)/i)?.[1]);
  if (!publishedAt) throw new Error('The original page did not provide a verifiable publication time.');
  if (Date.parse(publishedAt) > Date.now() + 300000) throw new Error('The article publication time is in the future.');
  if (isRussianSource(source) && !isRussiaFocused(title, summary)) throw new Error('Russian outlets are limited to Russia-focused stories.');
  const placement = articlePlacement(extracted, title, summary);
  if (!placement) throw new Error('The article could not be placed in a configured country or organisation. Add it manually in Manage site.');
  if (isRussianSource(source) && (placement.sectionId !== 'Miscellaneous' || placement.subsection !== 'RUSSIA / EURASIA')) throw new Error('Russian outlets are limited to the Russia section.');
  const agency = String(source.agencyName || source.name || data.metadata?.ogSiteName || data.metadata?.siteName || url.hostname).trim();
  return { id: `manual-${url.href}`, url: url.href, sourceId: 'manual', sourceName: agency, title, summary, publishedAt, reviewed: true, hidden: false, ...placement };
}
