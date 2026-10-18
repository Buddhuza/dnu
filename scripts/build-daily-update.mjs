import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { articlePlacement } from '../server/importArticle.js';
import { editorialScore, isRussianSource } from '../server/editorialPolicy.js';
import { NEWS_SECTIONS, MISCELLANEOUS_COUNTRIES, compareCountryLabels } from '../src/newsSections.js';
import { blockedPlacementReason, isUkrainianOutlet } from '../src/sourcePolicy.js';
import { preferredRegionalPlacement, ukraineAttackPlacement, russianTerritoryAttackPlacement } from '../src/storyPlacement.js';
import { deduplicateArticles } from '../src/siteConfig.js';
import { excludedHeadlineReason } from '../src/headlinePolicy.js';
import { carryForwardArticles } from '../server/updateCarryForward.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const day = process.env.COLLECTION_DAY || new Date().toISOString().slice(0, 10);
const runId = process.env.COLLECTION_RUN_ID || day;
const sources = JSON.parse(readFileSync(join(root, 'sources.json'), 'utf8'));
const state = JSON.parse(readFileSync(join(root, `data/collection-${runId}-working.json`), 'utf8'));
const previousPath = join(root, 'data/prepared-update.json');
const previous = existsSync(previousPath) ? JSON.parse(readFileSync(previousPath, 'utf8')) : { articles: [] };
const fallback = { sources: {} };
const recovery = { sources: {} };
const summariesPath = join(root, `data/collection-${day}-summary-fixes.json`);
const summaryFixes = existsSync(summariesPath) ? JSON.parse(readFileSync(summariesPath, 'utf8')) : {};
const verifiedTimesPath = join(root, `data/verified-time-corrections-${day}.json`);
const verifiedTimes = existsSync(verifiedTimesPath) ? JSON.parse(readFileSync(verifiedTimesPath, 'utf8')) : {};
const editorialExclusions = Object.assign({}, ...readdirSync(join(root, 'data'))
  .filter(name => /^editorial-exclusions-\d{4}-\d{2}-\d{2}\.json$/.test(name))
  .sort()
  .map(name => JSON.parse(readFileSync(join(root, 'data', name), 'utf8'))));
const sourceById = new Map(sources.map(source => [source.id, source]));
function cleanHeadline(article) {
  let title = String(article.title || '').trim();
  const source = sourceById.get(article.sourceId);
  if (!source) return title;
  const brand = source.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const host = new URL(source.url).hostname.replace(/^www\./, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  title = title.replace(new RegExp(`\\s[-–|]\\s(?:${brand}|${host})$`, 'i'), '').trim();
  title = title.replace(/\s[-–|]\s(?:Euronews Albania|Republika English|Civil Georgia|Khaama Press|The Copenhagen Post|Novinite\.com - Sofia News Agency)$/i, '').trim();
  if (source.id === 'source-93') title = title.replace(/\s-\s(?:TopNews|News from Embassies)(?:\s-\sAnsa\.it)?$/i, '').trim();
  return title;
}
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
  ['South Eastern Europe', 'Bosnia and Herzegovina', '', /\b(?:Bosnia|Bosnian|Herzegovina|Sarajevo|BiH)\b/i],
  ['South Eastern Europe', 'Montenegro', '', /\bMontenegro|Montenegrin|Podgorica\b/i],
  ['South Eastern Europe', 'North Macedonia', '', /\bNorth Macedonia|Macedonian|Skopje\b/i],
  ['South Eastern Europe', 'Serbia', '', /\bSerbia|Serbian|Belgrade\b/i],
  ['Eastern Europe', 'Belarus', '', /\bBelarus|Belarusian|Minsk\b/i],
  ['Eastern Europe', 'Moldova / Transdniestria', '', /\bTransdniestria|Transnistria\b/i],
  ['Eastern Europe', 'Moldova', '', /\bMoldova|Moldovan|Chisinau|Chișinău\b/i],
  ['Eastern Europe', 'Ukraine', '', /\b(?:Ukraine|Ukrainian|Kyiv|Zelenskyy|Zelensky|Zelenskiy|Sybiha|Umerov|Oleshky|Kharkiv|Odesa|Dnipro|Lviv)\b/i],
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
  ['Miscellaneous', 'MIDDLE EAST / NORTH AFRICA', 'Saudi Arabia', /\bSaudi Arabia|Saudi|Riyadh|Aramco\b/i],
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
  ...MISCELLANEOUS_COUNTRIES['INTERNATIONAL ORGANISATIONS'].map(name => ['Miscellaneous', 'INTERNATIONAL ORGANISATIONS', name, new RegExp(`\\b${name}\\b`, 'i')])
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
const overlappingAlbaniaRecaps = new Set([
  'https://www.tiranatimes.com/tirana-erupts-in-chaos-as-anti-government-protests-escalate/',
  'https://www.tiranatimes.com/student-protests-turn-violent-amid-growing-unrest-in-albania/',
  'https://en.vijesti.me/world-a/balkan/831492/photo-of-the-most-violent-protests-against-rame-water-cannons-burning-government-buildings-and-banks-stones-at-police-tear-gas'
]);
// The preceding edition is editorially reviewed. Keep its in-window stories even if
// their links fall off a listing or the new shortlist does not revisit them.
const current = Object.values(state.sources).flatMap(source => source.articles || []);
const raw = carryForwardArticles(current, previous.articles, state.windowStart, state.windowEnd, new Set(sourceById.keys())).map(article => ({ ...article, title: cleanHeadline(article), publishedAt: verifiedTimes[article.url]?.publishedAt || article.publishedAt, summary: summaryFixes[article.url] ? summaryFixes[article.url].replacement : article.summary })).sort((a, b) =>
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
  else if (editorialExclusions[article.url]) reason = editorialExclusions[article.url];
  else if (/T00:00:00(?:\.000)?Z$/.test(article.publishedAt)) reason = 'date-only or midnight time needs review';
  else if (!article.title?.trim() || !article.summary?.trim()) reason = 'headline or summary missing';
  else if (isUkrainianOutlet(article) && /\b(?:Ukraine|Ukrainian|Kyiv|Zelensk\w*|Oleshky|Volyn|Defen[cs]e Forces)\b/i.test(`${article.title} ${article.summary}`)) reason = 'Ukrainian outlet excluded from Ukraine coverage';
  else if (excludedHeadlineReason(article.title)) reason = excludedHeadlineReason(article.title);
  else if (/^live\s*:|^video\s*(?::|\/\/|\.)|\bvideo podcast\b/i.test(article.title)) reason = 'live stream or video page rather than a single news article';
  else if (/\b(?:analyst|expert|commentator)s?\s+(?:says|believes|warns|on\s+what)\b/i.test(article.title)) reason = 'analysis or commentary';
  else if (/^(?:political scientist|expert view|analysis):/i.test(article.title)) reason = 'analysis or commentary';
  else if (/\b(?:would be a mistake|the case for|why .+ matters)\b/i.test(article.title)) reason = 'opinion or analysis';
  else if (/^\s*(?:live updates?|live blog|live:)\b/i.test(article.title)) reason = 'live updates page rather than a single article';
  else if (/\b(?:biodiversity|COP17|climate summit|energy market|youth employment)\b/i.test(article.title) && !/\b(?:security|war|conflict|OSCE|NATO|sanction|military)\b/i.test(article.title)) reason = 'outside security and political scope';
  else if (/\b(?:sign language translator|teen develops AI)\b/i.test(article.title)) reason = 'technology feature outside security and political scope';
  else if (/\b(?:couples kept apart|former elementary school|special needs classroom)\b/i.test(article.title)) reason = 'human-interest or domestic crime story outside this update';
  else if (/\b(?:three|four|five|six|seven|eight|nine|ten|\d+)\s+takeaways\b/i.test(article.title) || /^(?:Germany|Ukraine|EU|Russia) news:/i.test(article.title)) reason = 'news roundup or analysis';
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
  const subjectPlacement = article.sourceId === 'source-109' ? { sectionId: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'Cyprus' }
    : /\bUkrainian drone attacks? on Belgorod\b/i.test(article.title) ? { sectionId: 'Miscellaneous', subsection: 'RUSSIA / EURASIA', country: 'Russia' }
    : article.sourceId === 'source-144' && /\b(?:Magyar|Hungar\w*)\b/i.test(article.title) ? { sectionId: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'Hungary' }
    : article.sourceId === 'source-26' && /\bLukashenko\b/i.test(article.title) ? { sectionId: 'Eastern Europe', subsection: 'Belarus', country: '' }
    : article.sourceId === 'source-10' && /\bMontenegro\b/i.test(article.title) ? { sectionId: 'South Eastern Europe', subsection: 'Montenegro', country: '' }
    : article.sourceId === 'source-61' && /\bKobakhidze\b/i.test(article.title) ? { sectionId: 'South Caucasus', subsection: 'Georgia', country: '' }
    : article.sourceId === 'source-171' && /\bRussian delegation\b.*\bAfghanistan\b/i.test(article.title) ? { sectionId: 'Miscellaneous', subsection: 'AFGHANISTAN / PAKISTAN', country: 'Afghanistan' }
    : article.sourceId === 'source-170' && /\bRussian FM\b.*\bAfghanistan\b/i.test(article.title) ? { sectionId: 'Miscellaneous', subsection: 'AFGHANISTAN / PAKISTAN', country: 'Afghanistan' }
    : article.sourceId === 'source-22' && /\bDacic\b.*\bMoscow\b/i.test(article.title) ? { sectionId: 'South Eastern Europe', subsection: 'Serbia', country: '' }
    : /\bPope\b.*\bPutin\b.*\bOleshky\b/i.test(article.title) ? { sectionId: 'Eastern Europe', subsection: 'Ukraine', country: '' }
    : /\bEU\b.*\b(?:drone|attack)\w*\b.*\bBulgaria\b/i.test(article.title) ? { sectionId: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'Bulgaria' }
    : /\b(?:Russian|Russia)\b.*\b(?:hit|strike\w*|attack\w*)\b.*\b(?:Ukraine|Ukrainian|Kyiv)\b/i.test(article.title) ? { sectionId: 'Eastern Europe', subsection: 'Ukraine', country: '' }
    : /\b(?:Trump|US)\b.*\bZelenskiy\b.*\b(?:Kyiv|Ukraine|support)\b/i.test(article.title) ? { sectionId: 'Eastern Europe', subsection: 'Ukraine', country: '' }
    : /\b(?:Iran|Iranian)\b.*\bHormuz\b|\bHormuz\b.*\b(?:Iran|Iranian)\b/i.test(article.title) ? { sectionId: 'Miscellaneous', subsection: 'MIDDLE EAST / NORTH AFRICA', country: 'Iran' }
    : /Bank of England governor.*IMF summit/i.test(article.title) ? { sectionId: 'Miscellaneous', subsection: 'INTERNATIONAL ORGANISATIONS', country: 'IMF' }
    : /Omagh bombing inquiry/i.test(article.title) ? { sectionId: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'United Kingdom' }
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
    : /\b(?:Saudi Arabia|Saudi|Aramco|Riyadh)\b/i.test(article.title) ? { sectionId: 'Miscellaneous', subsection: 'MIDDLE EAST / NORTH AFRICA', country: 'Saudi Arabia' }
    : null;
  const ukrainianFocus = isUkrainianOutlet(article) && /\b(?:Ukraine|Ukrainian|Kyiv|Zelenskyy|Zelensky|Zelenskiy|Sybiha|Umerov|Oleshky|Kharkiv|Odesa|Dnipro|Lviv)\b/i.test(article.title);
  const attackedRussia = russianTerritoryAttackPlacement(article.title);
  const attackedUkraine = !attackedRussia && !isUkrainianOutlet(article) && !(source && isRussianSource(source)) ? ukraineAttackPlacement(article.title, article.summary) : null;
  const inferred = attackedRussia || attackedUkraine || placementOverrides.get(article.url) || (ukrainianFocus ? { sectionId: 'Eastern Europe', subsection: 'Ukraine', country: '' } : null) || subjectPlacement || placementFromTitle(article.title) || contextPlaces.get(article.sourceId) || articlePlacement({}, article.title, '');
  let placement = inferred || (article.section ? { sectionId: article.section, subsection: article.subsection, country: article.country } : null);
  if (source && isRussianSource(source)) placement = { sectionId: 'Miscellaneous', subsection: 'RUSSIA / EURASIA', country: 'Russia' };
  if (!placement?.sectionId || !placement.subsection) { excluded.push({ ...article, reason: 'country or organisation needs editorial placement' }); continue; }
  placement = attackedUkraine || preferredRegionalPlacement(article, placement);
  const blockedSource = blockedPlacementReason(article, placement);
  if (blockedSource) { excluded.push({ ...article, reason: blockedSource }); continue; }
  if (placement.subsection === 'AFGHANISTAN / PAKISTAN' && !/\b(?:Russia|Russian|Kazakh\w*|Kyrgyz\w*|Tajik\w*|Turkmen\w*|Uzbek\w*|Central Asia\w*)\b/i.test(`${article.title} ${article.summary}`)) { excluded.push({ ...article, reason: 'Afghanistan story has no stated Russia or Central Asia connection' }); continue; }
  if (placement.sectionId === 'Miscellaneous' && !MISCELLANEOUS_COUNTRIES[placement.subsection]?.includes(placement.country)) { excluded.push({ ...article, reason: 'country or organisation outside configured sections' }); continue; }
  seenUrls.add(article.url);
  seenTitles.add(titleKey(article.title));
  accepted.push({ ...article, section: placement.sectionId, subsection: placement.subsection, country: placement.country || '' });
}

const unique = deduplicateArticles(accepted.map(article => ({ ...article, sectionId: article.section })));
const keptUrls = new Set(unique.map(article => article.url));
for (const article of accepted) if (!keptUrls.has(article.url)) excluded.push({ ...article, reason: 'same event covered by a preferred source' });
accepted.splice(0, accepted.length, ...accepted.filter(article => keptUrls.has(article.url)));

function eventKey(article) {
  const text = `${article.title} ${article.summary}`;
  if (/\b(?:St\.? Petersburg|Leningrad)\b/i.test(article.title) && /\b(?:drone\w*|oil facilit\w*|oil site\w*|oil terminal\w*|blaze|ablaze|strik\w*|attack\w*)\b/i.test(article.title)) return 'st-petersburg-drone-strike-2026-10-18';
  if (/\b(?:second|2nd)\b/i.test(article.title) && /\bsupertanker\b/i.test(article.title) && /\bmine\b/i.test(article.title)) return 'hormuz-second-tanker-mine';
  if (/\b(?:Egypt|Cairo)\b/i.test(article.title) && /\b(?:Saudi Arabia|Riyadh)\b/i.test(article.title) && /\bHouthi\w*\b/i.test(text) && /\b(?:support|help|defend|aid)\b/i.test(article.title)) return 'egypt-supports-saudi-after-houthi-attacks';
  if (/\bMacron\b/i.test(article.title) && /\b(?:hold accountable|bring down the Republic)\b/i.test(article.title)) return 'macron-protest-accountability';
  if (/\b(?:Russian defence ministry|Russia says)\b/i.test(article.title) && /\bsteel plants?\b/i.test(article.title) && /\bpower infrastructure\b/i.test(article.title)) return 'russia-ukraine-steel-plants-attack';
  if (/\bFalcons Meet\b/i.test(article.title) && /\b(?:exercise|training flights)\b/i.test(article.title)) return 'azerbaijan-falcons-meet-exercise';
  if (/\bRafiyev|Deputy FM\b/i.test(article.title) && /\b52nd OIC\b/i.test(article.title)) return 'azerbaijan-oic-deputy-fm';
  if (/\b(?:Trump|Graham Act|US president)\b/i.test(text) && /\b(?:Russia|Russian|Moscow)\b/i.test(text)
    && /\b(?:sanction\w*|tariff\w*)\b/i.test(text) && /\b(?:waiv\w*|suspend\w*|hold|halt\w*|pause\w*|put\w* on hold|won't impose|slams|regret\w*|delighted)\b/i.test(text)) return 'russia-sanctions-pause';
  if (/\bsettler\w*\b/i.test(text) && /\b(?:West Bank|olive|diplomat\w*|photographer|Washington Post)\b/i.test(text)
    && /\b(?:attack\w*|assault\w*|beat\w*|condemn\w*)\b/i.test(text)) return 'west-bank-settler-attack';
  if (/\bIMF\b/i.test(text) && /\b(?:walk\w* out|walkout|walked out)\b/i.test(text) && /\bRussia\w*\b/i.test(text)) return 'imf-russia-walkout';
  if (/\b(?:Pope|pontiff|Vatican)\b/i.test(text) && /\b(?:Putin|Russian President)\b/i.test(text) && /\b(?:call|talk|truce|aid|initiative|ceasefire)\b/i.test(text)) return 'pope-putin-call';
  if (/\bIran\w*\b/i.test(text) && /\b(?:Saudi|Riyadh|Houthi\w*)\b/i.test(text) && /\b(?:mediat\w*|political process)\b/i.test(text)) return 'iran-houthi-mediation';
  if (/\b(?:UN|United Nations)\b/i.test(text) && /\b(?:chief|secretary.general)\b/i.test(text) && /\b(?:candidate\w*|veto|vote|backing|support)\b/i.test(text)) return 'un-chief-selection-vote';
  if (/\bFrance\b/i.test(article.title) && /\b(?:protest\w*|demonstration\w*|clash\w*)\b/i.test(article.title)) return 'france-protests';
  return '';
}
function sourceRank(article) {
  if (/^Reuters$/i.test(article.sourceName)) return 6;
  if (/^(?:AP|AFP)$/i.test(article.sourceName)) return 5;
  if (/^BBC$/i.test(article.sourceName)) return 4;
  if (/^(?:DW|dpa|Guardian|Politico\.eu|Euronews)$/i.test(article.sourceName)) return 3;
  if (/^(?:Al Jazeera|L'Orient Today|RFE\/RL|Axios|NBC|AsiaOne)$/i.test(article.sourceName)) return 2;
  if (/^(?:AA|APA)$/i.test(article.sourceName)) return 2;
  return 1;
}
const eventWinners = new Map();
for (const article of accepted) {
  const key = eventKey(article);
  if (!key) continue;
  const previous = eventWinners.get(key);
  if (!previous || sourceRank(article) > sourceRank(previous)
    || sourceRank(article) === sourceRank(previous) && editorialScore(article.title, article.summary) > editorialScore(previous.title, previous.summary)) eventWinners.set(key, article);
}
const eventKept = accepted.filter(article => !eventKey(article) || eventWinners.get(eventKey(article))?.url === article.url);
for (const article of accepted) if (!eventKept.includes(article)) excluded.push({ ...article, reason: 'same development covered by a preferred source' });
accepted.splice(0, accepted.length, ...eventKept);

function leadScore(article, middleEast = false) {
  const impact = middleEast
    ? /\b(?:Hormuz|Iranian attack|Iran war|Israeli strike|ceasefire|shipping|missile)\b/i.test(`${article.title} ${article.summary}`) ? 200 : 0
    : /€70 billion|70 billion for 2027/i.test(article.title) ? 190
      : /\b(?:strike\w*|attack\w*|missile\w*|drone\w*|power infrastructure)\b/i.test(article.title) ? 170
      : /\b(?:sanction\w*|ceasefire|peace talks)\b/i.test(article.title) ? 110
        : /\b(?:EU accession|joint task force|grain cargoes)\b/i.test(article.title) ? 40 : 0;
  return editorialScore(article.title, article.summary) + impact + (agencyPriority.test(article.sourceName) ? (middleEast ? 75 : 1000) : 0) + articleDate(article) / 1e13;
}
const ukrainian = [];
const ukrainianAgencyCounts = new Map();
for (const article of accepted.filter(article => article.section === 'Eastern Europe' && article.subsection === 'Ukraine' && agencyPriority.test(article.sourceName)).sort((a, b) => leadScore(b) - leadScore(a))) {
  if ((ukrainianAgencyCounts.get(article.sourceName) || 0) >= 2) continue;
  ukrainian.push(article);
  ukrainianAgencyCounts.set(article.sourceName, (ukrainianAgencyCounts.get(article.sourceName) || 0) + 1);
  if (ukrainian.length === 4) break;
}
const middleEast = accepted.filter(article => article.section === 'Miscellaneous' && article.subsection === 'MIDDLE EAST / NORTH AFRICA'
  && /\b(?:Iran|Iranian|Israel|Israeli|Gaza|Lebanon|Lebanese|Syria|Syrian|Hormuz|Palestinian|Tehran|Beirut)\b/i.test(article.title)
  && /\b(?:war|strike\w*|attack\w*|ceasefire|missile\w*|sanction\w*|peace|talks|negotiat\w*|shipping|vessel\w*|nuclear|hostage\w*|truce|offensive)\b/i.test(article.title)
  && !/\b(?:Saudi Arabia|Saudi|Aramco|Riyadh|analyst|opinion|may be|could become)\b/i.test(article.title))
  .sort((a, b) => Number(/\bSaudi Arabia|Saudi|Riyadh|Aramco\b/i.test(a.title)) - Number(/\bSaudi Arabia|Saudi|Riyadh|Aramco\b/i.test(b.title)) || leadScore(b, true) - leadScore(a, true)).slice(0, 2);
for (const article of ukrainian) { article.section = 'Lead stories'; article.subsection = 'Ukraine'; article.country = ''; }
for (const article of middleEast) { article.section = 'Lead stories'; article.subsection = 'Middle East'; article.country = ''; }
accepted.sort((a, b) => (sectionOrder.get(a.section) ?? 999) - (sectionOrder.get(b.section) ?? 999)
  || (subsectionOrder.get(`${a.section}|${a.subsection}`) ?? 999) - (subsectionOrder.get(`${b.section}|${b.subsection}`) ?? 999)
  || compareCountryLabels(a.subsection, a.country, b.country)
  || (a.section === 'Lead stories' ? leadScore(b, a.subsection === 'Middle East') - leadScore(a, a.subsection === 'Middle East') : 0)
  || editorialScore(b.title, b.summary) - editorialScore(a.title, a.summary) || articleDate(b) - articleDate(a));

const sourceOutcomes = sources.map(source => {
  const result = state.sources[source.id];
  const extra = fallback.sources[source.id];
  const recovered = recovery.sources[source.id];
  if (!result) return { ...source, status: 'not checked', reason: 'This source has not been checked yet.' };
  const count = accepted.filter(article => article.sourceId === source.id).length;
  const editorialReasons = excluded.filter(article => article.sourceId === source.id && article.reason !== 'Ukrainian outlet excluded from Ukraine coverage')
    .reduce((totals, article) => (totals[article.reason] = (totals[article.reason] || 0) + 1, totals), {});
  const editorialDetail = Object.entries(editorialReasons).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([reason, number]) => `${number} ${reason}`).join('; ');
  const excludedUkraineCount = excluded.filter(article => article.sourceId === source.id && article.reason === 'Ukrainian outlet excluded from Ukraine coverage').length;
  const pages = [...result.attempts, ...(extra?.attempts || []), ...(recovered?.attempts || [])].reduce((total, attempt) => total + (attempt.fetched || 0), 0);
  const listed = [...result.attempts, ...(extra?.attempts || []), ...(recovered?.attempts || [])].reduce((total, attempt) => total + (attempt.listed || 0), 0);
  const previouslyScraped = result.attempts.reduce((total, attempt) => total + (attempt.previouslyScraped || 0), 0);
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
  const reason = (count
    ? `${count} verified ${count === 1 ? 'article' : 'articles'} included; ${pages} original article pages checked.`
    : `${listed} links listed and ${pages} original article pages checked across ${result.attempts.length + (extra?.attempts.length || 0) + (recovered?.attempts.length || 0)} collection methods; ${status === 'failed' ? 'no usable original article page could be obtained' : 'no article from this outlet was verified and included for the requested window'}.${previouslyScraped ? ` ${previouslyScraped} listing candidates had been scraped in an earlier batch and were not scraped again.` : ''}${unverifiedTimes ? ` ${unverifiedTimes} candidate article timestamps were date-only or midnight values and could not verify the full window.` : ''}${newestListing ? ` Newest dated listing: ${newestListing}.` : ''}${rejectionDetails ? ` Article checks: ${rejectionDetails}.` : ''}${errors.length ? ` Errors: ${errors.slice(0, 2).join('; ')}` : ''}`)
    + (editorialDetail && !count ? ` Editorial selection: ${editorialDetail}.` : '')
    + (excludedUkraineCount ? ` ${excludedUkraineCount} Ukraine-placed ${excludedUkraineCount === 1 ? 'article was' : 'articles were'} excluded under the outlet policy.` : '');
  return { id: source.id, name: source.name, group: source.group, url: source.url, status, reason };
});
const update = { title: 'DAILY NEWS UPDATE', checkedAt: new Date().toISOString(), windowHours: (end - start) / 3600000, windowStart: state.windowStart, windowEnd: state.windowEnd, articles: accepted, sourceOutcomes };
const output = join(root, `data/daily-update-${day}.json`);
// Keep each published edition for audit while replacing the active update.
if (existsSync(previousPath) && previous.checkedAt && previous.checkedAt !== update.checkedAt) {
  const archive = join(root, `data/daily-update-${previous.checkedAt.replace(/[:.]/g, '-')}.json`);
  if (!existsSync(archive)) writeFileSync(archive, `${JSON.stringify(previous, null, 2)}\n`);
}
writeFileSync(output, `${JSON.stringify(update, null, 2)}\n`);
writeFileSync(previousPath, `${JSON.stringify(update, null, 2)}\n`);
writeFileSync(join(root, `data/collection-${runId}-review.json`), `${JSON.stringify({ excluded, incompleteSources: sources.filter(source => state.sources[source.id]?.status !== 'complete').map(source => source.id) }, null, 2)}\n`);
console.log(JSON.stringify({ completeSources: sourceOutcomes.filter(source => state.sources[source.id]?.status === 'complete').length, sources: sources.length, articles: accepted.length, excluded: excluded.length, output }));
