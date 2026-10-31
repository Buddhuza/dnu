import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const audit = JSON.parse(readFileSync(join(root, 'data/direct-feed-36h-result.json'), 'utf8'));
const sources = JSON.parse(readFileSync(join(root, 'sources.json'), 'utf8'));
const selected = [
  ['Zelenskyy urges US to speed up Patriot deliveries', 'Washington approved the sale of 500 interceptors, but Kyiv says delivery may take years.', 'Lead stories', 'Ukraine', ''],
  ['Oleshky evacuees reunite with families after truce allows crossing back into Ukraine', 'The rescue operation began Friday under a local truce, with evacuees travelling through Russia and Belarus.', 'Lead stories', 'Ukraine', ''],
  ['Turkiye’s Erdogan urges Russia and Ukraine to stop Black Sea attacks', 'He and Zelenskyy agreed to work on a new grain corridor through the waterway.', 'Lead stories', 'Ukraine', ''],
  ['Iran’s Revolutionary Guard reports three tankers on fire in Strait of Hormuz as talks continue', 'The Guard said the vessels used routes Tehran considers unauthorised but did not identify the ships or their crews.', 'Lead stories', 'Middle East', ''],
  ['At least four Palestinians killed in Gaza as Israeli attacks continue', 'Shelling of the Nuseirat refugee camp killed a teacher, according to al-Awda Hospital.', 'Lead stories', 'Middle East', ''],
  ['Aliyev to skip Turkey-led summit for first time in more than a decade amid growing tension', 'Foreign Minister Jeyhun Bayramov will represent Azerbaijan at the Organisation of Turkic States meeting.', 'South Caucasus', 'Azerbaijan', ''],
  ['Georgia, Azerbaijan Hold Intergovernmental Meeting, Talk ‘Speeding Up’ Border Process', 'Their prime ministers met in Tbilisi and discussed trade, energy and the shared border near David Gareji.', 'South Caucasus', 'Georgia', ''],
  ['Kobakhidze again says Tbilisi ‘ready’ to restore US-Georgia ties after chargé d’affaires meeting', 'Relations have been effectively frozen since the Biden administration, and Washington has had no ambassador in Tbilisi since July 2025.', 'South Caucasus', 'Georgia', ''],
  ['More than 290 arrested in France as some weekend protests turn violent', 'The interior ministry counted 320,000 demonstrators nationwide, including 70,000 in Paris.', 'Miscellaneous', 'WESTERN / CENTRAL EUROPE', 'France'],
  ['Polish president Nawrocki pushes his way into top court amid rule-of-law tussle', 'He entered the Constitutional Tribunal amid a dispute over the appointment of its acting president.', 'Miscellaneous', 'WESTERN / CENTRAL EUROPE', 'Poland'],
  ['Starmer says UK must get closer to Europe as US relationship changes', 'The former prime minister warned European leaders about Russia and said relations with Washington were unlikely to reset soon.', 'Miscellaneous', 'WESTERN / CENTRAL EUROPE', 'UK'],
  ["U.S. Embassy Warns of Potential 'Mass Casualty Event' in Moscow", 'The embassy cited a threat at the Tsaritsyno Museum Reserve and said it was coordinating with Russian authorities.', 'Miscellaneous', 'RUSSIA / EURASIA', 'Russia'],
  ["They strangled us, says founder of Russian newspaper shut under pressure from authorities", 'Novaya Gazeta says it is being evicted from its long-time offices and blocked from receiving donations.', 'Miscellaneous', 'RUSSIA / EURASIA', 'Russia'],
  ['North Korea warns South Korea with ballistic missiles as Seoul calls for talks to ease border tensions', 'South Korea said roughly a dozen missiles were launched from Wonsan and travelled about 250 kilometres.', 'Miscellaneous', 'NORTH EAST ASIA', 'North Korea'],
  ['Canada and EU announce new alliance open to like-minded countries', 'Mark Carney and Ursula von der Leyen announced the Alliance for the Future during talks in Montreal.', 'Miscellaneous', 'NORTH AMERICA', 'Canada'],
  ['UN peacekeeping mission in Western Sahara to expire amid US, Russia vetoes', 'The Security Council failed to renew MINURSO after Washington and Moscow vetoed each other’s draft resolutions.', 'Miscellaneous', 'INTERNATIONAL ORGANISATIONS', 'UN'],
  ['G20 foreign ministers end Atlanta meeting without consensus on key issues', 'The group issued a chair’s statement instead of a joint communiqué after divisions over the war in Ukraine.', 'Miscellaneous', 'INTERNATIONAL ORGANISATIONS', 'G20']
];

const byTitle = new Map(audit.articles.map(article => [article.title, article]));
const articles = selected.map(([title, summary, section, subsection, country]) => {
  const item = byTitle.get(title);
  if (!item || item.status !== 'verified' || !item.pageDateMatchesFeed || !item.body || Date.parse(item.pageDate) < Date.parse(audit.windowStart) || Date.parse(item.pageDate) > Date.parse(audit.windowEnd)) throw new Error(`Selected story is not article-page verified in window: ${title}`);
  const source = sources.find(source => source.id === item.sourceId);
  return { id: item.url, url: item.url, sourceId: item.sourceId, sourceName: item.sourceName, group: source.group, title, summary, publishedAt: item.pageDate, section, subsection, country, reviewed: true };
});

const selectedCounts = new Map();
for (const article of articles) selectedCounts.set(article.sourceId, (selectedCounts.get(article.sourceId) || 0) + 1);
const feedById = new Map(audit.feeds.map(feed => [feed.sourceId, feed]));
const sourceOutcomes = sources.map(source => {
  const feed = feedById.get(source.id);
  if (!feed) return { ...source, status: 'not-checked', reason: 'Outside this direct-feed-only 36-hour collection.' };
  const count = selectedCounts.get(source.id) || 0;
  const checked = audit.articles.filter(article => article.sourceId === source.id);
  const verified = checked.filter(article => article.status === 'verified' && article.pageDateMatchesFeed && Date.parse(article.pageDate) >= Date.parse(audit.windowStart) && Date.parse(article.pageDate) <= Date.parse(audit.windowEnd)).length;
  const failures = checked.filter(article => article.status === 'failed').length;
  return { ...source, status: count ? 'collected' : feed.status === 'failed' ? 'failed' : 'checked', reason: `${feed.inWindow} feed items in the 36-hour window; ${verified} original pages had usable text and page dates; ${failures} page fetches failed; ${count} selected for this update.${feed.status === 'failed' ? ` Feed failed: ${feed.attempts.map(attempt => attempt.error).join('; ')}.` : ''}` };
});
const edition = { title: 'DAILY NEWS UPDATE', checkedAt: audit.windowEnd, windowHours: 36, windowStart: audit.windowStart, windowEnd: audit.windowEnd, articles, sourceOutcomes };
writeFileSync(join(root, 'data/prepared-update.json'), `${JSON.stringify(edition, null, 2)}\n`);
writeFileSync(join(root, 'data/daily-update-2026-10-31.json'), `${JSON.stringify(edition, null, 2)}\n`);

const cacheRecords = articles.map(article => {
  const item = byTitle.get(article.title);
  const page = { markdown: item.body, metadata: { title: article.title, sourceURL: article.url, publishedTime: article.publishedAt } };
  return JSON.stringify({ url: article.url, pageGzip: gzipSync(JSON.stringify(page)).toString('base64'), fetchedAt: audit.windowEnd, extractionVersion: 2, failedAt: null });
});
writeFileSync(join(root, 'data/article-cache-2026-10-31.jsonl'), `${cacheRecords.join('\n')}\n`);
console.log(`Prepared ${articles.length} verified stories and their full-body cache from ${audit.candidateCount} shortlisted pages.`);
