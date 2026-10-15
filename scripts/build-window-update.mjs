import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { articlePlacement } from '../server/importArticle.js';
import { editorialScore, isRussianSource } from '../server/editorialPolicy.js';
import { NEWS_SECTIONS, MISCELLANEOUS_COUNTRIES } from '../src/newsSections.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const sources = JSON.parse(readFileSync(join(root, 'sources.json'), 'utf8'));
const state = JSON.parse(readFileSync(join(root, 'data/collection-2026-10-14-working.json'), 'utf8'));
const fallbackPath = join(root, 'data/collection-2026-10-14-fallback.json');
const fallback = existsSync(fallbackPath) ? JSON.parse(readFileSync(fallbackPath, 'utf8')) : { sources: {} };
const recoveryPath = join(root, 'data/collection-2026-10-14-recovery.json');
const recovery = existsSync(recoveryPath) ? JSON.parse(readFileSync(recoveryPath, 'utf8')) : { sources: {} };
const summariesPath = join(root, 'data/collection-2026-10-14-summary-fixes.json');
const summaryFixes = existsSync(summariesPath) ? JSON.parse(readFileSync(summariesPath, 'utf8')) : {};
const sourceById = new Map(sources.map(source => [source.id, source]));
const start = Date.parse(state.windowStart);
const end = Date.parse(state.windowEnd);
const titleKey = title => String(title).replace(/^video\.\s*/i, '').replace(/\s*\[(?:photos?|videos?|photos?\/videos?)\]\s*$/i, '').replace(/\s+videos?\s*$/i, '').replace(/\s*[|–-]\s*(?:News\.az|The Moscow Times|Gazeta Express|Euronews)\s*$/i, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const articleDate = article => Date.parse(article.publishedAt);
const sectionOrder = new Map(NEWS_SECTIONS.map((section, index) => [section.id, index]));
const subsectionOrder = new Map(NEWS_SECTIONS.flatMap(section => section.subsections.map((name, index) => [`${section.id}|${name}`, index])));
const agencyPriority = /^(Reuters|AP|AFP|DW|Politico\.eu|Euronews|BBC|dpa|Guardian)$/i;
const titlePlaces = [
  ['South Eastern Europe', 'Serbia / Kosovo', '', /\bKosovo|Kosovar|Pristina|Prishtina\b/i],
  ['South Eastern Europe', 'Albania', '', /\bAlbania|Albanian|Tirana\b/i],
  ['South Eastern Europe', 'Bosnia and Herzegovina', '', /\bBosnia|Bosnian|Herzegovina|Sarajevo\b/i],
  ['South Eastern Europe', 'Montenegro', '', /\bMontenegro|Montenegrin|Podgorica\b/i],
  ['South Eastern Europe', 'North Macedonia', '', /\bNorth Macedonia|Macedonian|Skopje\b/i],
  ['South Eastern Europe', 'Serbia', '', /\bSerbia|Serbian|Belgrade\b/i],
  ['Eastern Europe', 'Belarus', '', /\bBelarus|Belarusian|Minsk\b/i],
  ['Eastern Europe', 'Moldova / Transdniestria', '', /\bTransdniestria|Transnistria\b/i],
  ['Eastern Europe', 'Moldova', '', /\bMoldova|Moldovan|Chisinau|Chișinău\b/i],
  ['Eastern Europe', 'Ukraine', '', /\bUkraine|Ukrainian|Kyiv|Zelenskyy\b/i],
  ['South Caucasus', 'Armenia', '', /\bArmenia|Armenian|Yerevan|Pashinyan\b/i],
  ['South Caucasus', 'Azerbaijan', '', /\bAzerbaijan|Azerbaijani|Baku\b/i],
  ['South Caucasus', 'Georgia / Abkhazia / South Ossetia', '', /\bAbkhazia|South Ossetia\b/i],
  ['South Caucasus', 'Georgia', '', /\bGeorgia|Georgian|Tbilisi\b/i],
  ['Central Asia', 'Kazakhstan', '', /\bKazakhstan|Kazakh|Astana\b/i],
  ['Central Asia', 'Kyrgyzstan', '', /\bKyrgyzstan|Kyrgyz|Bishkek\b/i],
  ['Central Asia', 'Tajikistan', '', /\bTajikistan|Tajik|Dushanbe\b/i],
  ['Central Asia', 'Turkmenistan', '', /\bTurkmenistan|Turkmen|Ashgabat\b/i],
  ['Central Asia', 'Uzbekistan', '', /\bUzbekistan|Uzbek|Tashkent\b/i],
  ['Miscellaneous', 'RUSSIA / EURASIA', 'Russia', /\bRussia|Russian|Moscow|Kremlin|Putin\b/i],
  ['Miscellaneous', 'WESTERN / CENTRAL EUROPE', 'Germany', /\bGermany|German|Berlin|Merz\b/i],
  ['Miscellaneous', 'WESTERN / CENTRAL EUROPE', 'Slovakia', /\bSlovakia|Slovak|Fico\b/i],
  ['Miscellaneous', 'WESTERN / CENTRAL EUROPE', 'Czechia', /\bCzechia|Czech|Prague|Babiš|Babis\b/i],
  ['Miscellaneous', 'WESTERN / CENTRAL EUROPE', 'United Kingdom', /\bUnited Kingdom|Britain|British|UK|London\b/i],
  ['Miscellaneous', 'WESTERN / CENTRAL EUROPE', 'France', /\bFrance|French|Paris\b/i],
  ['Miscellaneous', 'WESTERN / CENTRAL EUROPE', 'Italy', /\bItaly|Italian|Rome\b/i],
  ['Miscellaneous', 'WESTERN / CENTRAL EUROPE', 'Poland', /\bPoland|Polish|Warsaw\b/i],
  ['Miscellaneous', 'WESTERN / CENTRAL EUROPE', 'Bulgaria', /\bBulgaria|Bulgarian|Sofia\b/i],
  ['Miscellaneous', 'WESTERN / CENTRAL EUROPE', 'Spain', /\bSpain|Spanish|Madrid\b/i],
  ['Miscellaneous', 'WESTERN / CENTRAL EUROPE', 'Netherlands', /\bNetherlands|Dutch|Amsterdam|The Hague\b/i],
  ['Miscellaneous', 'MIDDLE EAST / NORTH AFRICA', 'Iran', /\bIran|Iranian|Tehran|Hormuz\b/i],
  ['Miscellaneous', 'MIDDLE EAST / NORTH AFRICA', 'Israel', /\bIsrael|Israeli|Palestinian|Gaza|West Bank\b/i],
  ['Miscellaneous', 'MIDDLE EAST / NORTH AFRICA', 'Lebanon', /\bLebanon|Lebanese|Beirut\b/i],
  ['Miscellaneous', 'MIDDLE EAST / NORTH AFRICA', 'Syria', /\bSyria|Syrian|Damascus\b/i],
  ['Miscellaneous', 'MIDDLE EAST / NORTH AFRICA', 'Libya', /\bLibya|Libyan\b/i],
  ['Miscellaneous', 'MIDDLE EAST / NORTH AFRICA', 'Türkiye', /\bTürkiye|Turkey|Turkish|Ankara\b/i],
  ['Miscellaneous', 'NORTH EAST ASIA', 'China', /\bChina|Chinese|Beijing\b/i],
  ['Miscellaneous', 'NORTH EAST ASIA', 'Japan', /\bJapan|Japanese|Tokyo\b/i],
  ['Miscellaneous', 'NORTH EAST ASIA', 'North Korea', /\bNorth Korea|Pyongyang\b/i],
  ['Miscellaneous', 'NORTH EAST ASIA', 'South Korea', /\bSouth Korea|Seoul\b/i],
  ['Miscellaneous', 'NORTH EAST ASIA', 'Mongolia', /\bMongolia|Mongolian\b/i],
  ['Miscellaneous', 'NORTH AMERICA', 'United States', /\b(?:United States|U\.S\.|US|American|Washington|Trump)\b/i],
  ['Miscellaneous', 'NORTH AMERICA', 'Canada', /\bCanada|Canadian|Ottawa\b/i],
  ...['OSCE', 'EU', 'NATO', 'UN', 'G7', 'G20', 'ICC', 'WTO', 'IMF', 'CIS', 'CSTO'].map(name => ['Miscellaneous', 'INTERNATIONAL ORGANISATIONS', name, new RegExp(`\\b${name}\\b`, 'i')])
];
const contextPlaces = new Map([
  ['source-51', { sectionId: 'South Caucasus', subsection: 'Armenia', country: '' }],
  ['source-60', { sectionId: 'South Caucasus', subsection: 'Azerbaijan', country: '' }],
  ['source-88', { sectionId: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'Bulgaria' }],
  ['source-132', { sectionId: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'Netherlands' }]
]);
const placementOverrides = new Map([
  ['https://www.dpa-international.com/politics/urn:newsml:dpa.com:20090101:261014-930-841003', { sectionId: 'Eastern Europe', subsection: 'Ukraine', country: '' }],
  ['https://www.reuters.com/world/europe/us-floats-unfreezing-some-russian-assets-restart-ukraine-peace-talks-ft-reports-2026-10-14/', { sectionId: 'Eastern Europe', subsection: 'Ukraine', country: '' }],
  ['https://www.itv.com/news/2026-10-14/pm-looks-to-repair-bridges-between-trump-and-zelensky-after-us-diesel-deal', { sectionId: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'United Kingdom' }],
  ['https://ipn.md/en/ukraine-will-increase-by-20-the-water-flow-discharged-from-novodnestrovsk-prime-minister-tofan/', { sectionId: 'Eastern Europe', subsection: 'Moldova', country: '' }],
  ['https://www.iranintl.com/en/202610142337', { sectionId: 'Miscellaneous', subsection: 'MIDDLE EAST / NORTH AFRICA', country: 'Iran' }]
]);
function placementFromTitle(title) {
  const matches = titlePlaces.map(([sectionId, subsection, country, pattern], priority) => ({ sectionId, subsection, country, priority, index: title.search(pattern) })).filter(item => item.index >= 0);
  matches.sort((a, b) => a.index - b.index || a.priority - b.priority);
  return matches[0] || null;
}

const summaryOverrides = new Map([
  ['https://apnews.com/article/russia-ukraine-war-zelenskyy-burnham-trump-putin-9fe44ec1bb361f19d46dfafb58da46f6', 'Kyiv also endured a second consecutive night of missile attacks, officials said.']
]);
const raw = [...Object.values(state.sources), ...Object.values(fallback.sources), ...Object.values(recovery.sources)].flatMap(source => source.articles || []).map(article => ({ ...article, title: article.sourceId === 'source-93' ? article.title.replace(/ - (?:TopNews|News from Embassies) - Ansa\.it$/i, '') : article.title, summary: summaryOverrides.get(article.url) || summaryFixes[article.url]?.replacement || article.summary })).sort((a, b) =>
  Number(agencyPriority.test(b.sourceName)) - Number(agencyPriority.test(a.sourceName)) || String(b.summary || '').length - String(a.summary || '').length);
const accepted = [];
const excluded = [];
const seenUrls = new Set();
const seenTitles = new Set();
for (const article of raw) {
  const source = sourceById.get(article.sourceId);
  const time = articleDate(article);
  let reason = '';
  if (!Number.isFinite(time) || time < start || time >= end) reason = 'outside requested window';
  else if (/\/2026\/10\/1[0-3]\//.test(new URL(article.url).pathname)) reason = 'article URL predates requested window';
  else if (/T00:00:00(?:\.000)?Z$/.test(article.publishedAt)) reason = 'date-only or midnight time needs review';
  else if (!article.title?.trim() || !article.summary?.trim()) reason = 'headline or summary missing';
  else if (article.sourceId === 'source-167') reason = 'all collected Foreign Policy pages were opinion or analysis';
  else if (article.sourceId === 'source-123' && /\b(?:Makkah Alliance|Omani FM|Dar urges regional powers)\b/i.test(article.title)) reason = 'Pakistan-focused story outside the configured Afghanistan coverage';
  else if (/Washington panel urges continued US support for Kurdistan/i.test(article.title)) reason = 'Iraq-focused story outside the configured countries';
  else if (/\b(?:opinion|analysis|commentary|blog)\b/i.test(new URL(article.url).pathname) || /^\s*(?:opinion|analysis|blog)\b/i.test(article.title)) reason = 'opinion or analysis';
  else if (/\b(?:sport|football|Mahomes|NFL|Week 6|architecture biennial|celebrity|fashion|entertainment|film festival|audience growth|agrotown|Mont Blanc|World Health Summit|CreaTech Summit|Naruto and beyond|Cushman & Wakefield|Lufthansa wins privatisation|Temu and Shein orders|Biophysicists Discuss Cooperation|Teacher Training and Education Research)\b/i.test(article.title)) reason = 'outside the requested subject';
  else if (/\b(?:The Rise and Fall of Kimberly Guilfoyle|Cait Conley talks Iran|Selling to Every Buyer:|Trump plays Russian roulette|Zelenskyy sits down with NPR\. And,|President Trump Campaigns for Arizona GOP|PL accuses PN of failing to correct statement)\b/i.test(article.title)) reason = 'opinion, roundup, or local party politics';
  else if (/^(?:Russians Were Told Where To Look For|FnV strongly critical of Meloni)/i.test(article.title)) reason = 'social-media reaction or local party politics';
  else if (/\b(?:livestreams|listen live|latest news,|news, livestreams|newsletter signup|Afghanistan News Today|Live Updates:|Pentagon and Congress)\b/i.test(article.title) || /^(?:watch|video):/i.test(article.title) || /\/(?:category|tag|archive|videos)(?:\/|$)/i.test(new URL(article.url).pathname) || /\/all[-_]news\/page\//i.test(article.url) || (source && new URL(article.url).pathname.replace(/\/$/, '') === new URL(source.url).pathname.replace(/\/$/, ''))) reason = 'listing page rather than an article';
  else if (/\b(?:op-ed|opinion|analysis)\b/i.test(article.title) || /\b(?:will only worsen the death toll|america has sided with russia against ukraine|must build a coalition against|trump’s ukraine ultimatum:)\b/i.test(article.title)) reason = 'opinion or analysis';
  else if (seenUrls.has(article.url)) reason = 'duplicate URL';
  else if (seenTitles.has(titleKey(article.title))) reason = 'duplicate headline already covered';
  if (reason) { excluded.push({ ...article, reason }); continue; }
  const subjectPlacement = /Omagh bombing inquiry/i.test(article.title) ? { sectionId: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'United Kingdom' }
    : /Starlink: Musk says US government may be behind slowdown of Ukraine/i.test(article.title) ? { sectionId: 'Eastern Europe', subsection: 'Ukraine', country: '' }
    : /Burnham treads carefully in Zelensky visit/i.test(article.title) ? { sectionId: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'United Kingdom' }
    : /US keeps Kosovo talks on hold/i.test(article.title) || /Kurti meets NATO and KFOR commanders/i.test(article.title) ? { sectionId: 'South Eastern Europe', subsection: 'Serbia / Kosovo', country: '' }
    : /EU calls for investigation into police violence claims/i.test(article.title) ? { sectionId: 'South Eastern Europe', subsection: 'Albania', country: '' }
    : /EU membership to further connect Montenegro/i.test(article.title) ? { sectionId: 'South Eastern Europe', subsection: 'Montenegro', country: '' }
    : /EU disburses .* to Ukraine/i.test(article.title) ? { sectionId: 'Eastern Europe', subsection: 'Ukraine', country: '' }
    : /NATO expects swift formation of government in Bosnia/i.test(article.title) ? { sectionId: 'South Eastern Europe', subsection: 'Bosnia and Herzegovina', country: '' }
    : /Meloni Recalled The Berlin Wall And Russian Tanks/i.test(article.title) ? { sectionId: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'Italy' }
    : /Russian Railway Chief Holds .* Talks With Pashinian/i.test(article.title) ? { sectionId: 'South Caucasus', subsection: 'Armenia', country: '' }
    : /Russians Were Told Where To Look For .*Belarus/i.test(article.title) ? { sectionId: 'Eastern Europe', subsection: 'Belarus', country: '' }
    : /UN envoy says Libya/i.test(article.title) ? { sectionId: 'Miscellaneous', subsection: 'MIDDLE EAST / NORTH AFRICA', country: 'Libya' }
    : /European Security Council/i.test(article.title) ? { sectionId: 'Miscellaneous', subsection: 'INTERNATIONAL ORGANISATIONS', country: 'EU' }
    : /\bUNHCR\b/i.test(article.title) ? { sectionId: 'Miscellaneous', subsection: 'INTERNATIONAL ORGANISATIONS', country: 'UN' }
    : /\bHegseth\b/i.test(article.title) ? { sectionId: 'Miscellaneous', subsection: 'NORTH AMERICA', country: 'United States' }
    : null;
  const inferred = placementOverrides.get(article.url) || subjectPlacement || placementFromTitle(article.title) || contextPlaces.get(article.sourceId) || articlePlacement({}, article.title, '');
  let placement = inferred || (article.section ? { sectionId: article.section, subsection: article.subsection, country: article.country } : null);
  if (source && isRussianSource(source)) placement = { sectionId: 'Miscellaneous', subsection: 'RUSSIA / EURASIA', country: 'Russia' };
  if (!placement?.sectionId || !placement.subsection) { excluded.push({ ...article, reason: 'country or organisation needs editorial placement' }); continue; }
  if (placement.subsection === 'AFGHANISTAN / PAKISTAN' && !/\b(?:Russia|Russian|Kazakh\w*|Kyrgyz\w*|Tajik\w*|Turkmen\w*|Uzbek\w*|Central Asia\w*)\b/i.test(`${article.title} ${article.summary}`)) { excluded.push({ ...article, reason: 'Afghanistan story has no stated Russia or Central Asia connection' }); continue; }
  if (placement.sectionId === 'Miscellaneous' && !MISCELLANEOUS_COUNTRIES[placement.subsection]?.includes(placement.country)) { excluded.push({ ...article, reason: 'country or organisation outside configured sections' }); continue; }
  seenUrls.add(article.url);
  seenTitles.add(titleKey(article.title));
  accepted.push({ ...article, section: placement.sectionId, subsection: placement.subsection, country: placement.country || '' });
}

function leadScore(article, middleEast = false) {
  const impact = middleEast && /\b(?:Hormuz|Iranian attack|Iran war|Israeli strike|ceasefire|shipping|missile)\b/i.test(`${article.title} ${article.summary}`) ? 200 : 0;
  return editorialScore(article.title, article.summary) + impact + (agencyPriority.test(article.sourceName) ? (middleEast ? 75 : 1000) : 0) + articleDate(article) / 1e13;
}
const ukrainian = accepted.filter(article => article.section === 'Eastern Europe' && article.subsection === 'Ukraine').sort((a, b) => leadScore(b) - leadScore(a)).slice(0, 4);
const middleEast = accepted.filter(article => article.section === 'Miscellaneous' && article.subsection === 'MIDDLE EAST / NORTH AFRICA').sort((a, b) => leadScore(b, true) - leadScore(a, true)).slice(0, 2);
for (const article of ukrainian) { article.section = 'Lead stories'; article.subsection = 'Ukraine'; article.country = ''; }
for (const article of middleEast) { article.section = 'Lead stories'; article.subsection = 'Middle East'; article.country = ''; }
accepted.sort((a, b) => (sectionOrder.get(a.section) ?? 999) - (sectionOrder.get(b.section) ?? 999)
  || (subsectionOrder.get(`${a.section}|${a.subsection}`) ?? 999) - (subsectionOrder.get(`${b.section}|${b.subsection}`) ?? 999)
  || a.country.localeCompare(b.country, 'en') || editorialScore(b.title, b.summary) - editorialScore(a.title, a.summary) || articleDate(b) - articleDate(a));

const sourceOutcomes = sources.map(source => {
  const result = state.sources[source.id];
  const extra = fallback.sources[source.id];
  const recovered = recovery.sources[source.id];
  if (!result) return { ...source, status: 'not checked', reason: 'This source has not been checked yet.' };
  const count = accepted.filter(article => article.sourceId === source.id).length;
  const pages = result.checkedUrls.length + (extra?.checkedUrls.length || 0) + (recovered?.checkedUrls.length || 0);
  const listed = [...result.attempts, ...(extra?.attempts || []), ...(recovered?.attempts || [])].reduce((total, attempt) => total + (attempt.listed || 0), 0);
  const errors = [...result.errors, ...result.attempts.flatMap(attempt => attempt.errors || []), ...(extra?.errors || []), ...(recovered?.errors || [])];
  const rejected = result.attempts.reduce((totals, attempt) => {
    for (const [reason, number] of Object.entries(attempt.rejected || {})) totals[reason] = (totals[reason] || 0) + number;
    return totals;
  }, {});
  const rejectionDetails = Object.entries(rejected).filter(([, number]) => number > 0).map(([reason, number]) => `${number} ${reason.replace(/([A-Z])/g, ' $1').toLowerCase()}`).join(', ');
  const visibleDates = result.attempts.flatMap(attempt => attempt.listedArticles || []).map(item => item.publishedAt).filter(value => Number.isFinite(Date.parse(value)));
  const newestListing = visibleDates.length ? new Date(Math.max(...visibleDates.map(Date.parse))).toISOString().slice(0, 10) : '';
  const status = count ? 'collected' : pages ? 'checked' : errors.length ? 'failed' : listed ? 'checked' : 'failed';
  const unverifiedTimes = new Set([...(result.articles || []).filter(article => /T00:00:00(?:\.000)?Z$/.test(article.publishedAt)).map(article => article.url), ...(recovered?.dateOnly || []).map(article => article.url)]).size;
  const reason = count
    ? `${count} verified ${count === 1 ? 'article' : 'articles'} included; ${pages} original article pages checked.`
    : `${listed} links listed and ${pages} original article pages checked across ${result.attempts.length + (extra?.attempts.length || 0) + (recovered?.attempts.length || 0)} collection methods; ${status === 'failed' ? 'no usable original article page could be obtained' : 'no article from this outlet was verified and included for the requested window'}.${unverifiedTimes ? ` ${unverifiedTimes} candidate article timestamps were date-only or midnight values and could not verify the full window.` : ''}${newestListing ? ` Newest dated listing: ${newestListing}.` : ''}${rejectionDetails ? ` Article checks: ${rejectionDetails}.` : ''}${errors.length ? ` Errors: ${errors.slice(0, 2).join('; ')}` : ''}`;
  return { id: source.id, name: source.name, group: source.group, url: source.url, status, reason };
});
const update = { title: 'DAILY NEWS UPDATE', checkedAt: new Date().toISOString(), windowHours: 24, windowStart: state.windowStart, windowEnd: state.windowEnd, articles: accepted, sourceOutcomes };
const output = join(root, 'data/daily-update-2026-10-14-15.json');
writeFileSync(output, `${JSON.stringify(update, null, 2)}\n`);
writeFileSync(join(root, 'data/collection-2026-10-14-review.json'), `${JSON.stringify({ excluded, incompleteSources: sources.filter(source => state.sources[source.id]?.status !== 'complete').map(source => source.id) }, null, 2)}\n`);
console.log(JSON.stringify({ completeSources: sourceOutcomes.filter(source => state.sources[source.id]?.status === 'complete').length, sources: sources.length, articles: accepted.length, excluded: excluded.length, output }));
