import { conciseDnuSummary } from './conciseSummary.js';

// Editorial review of the 19 November native draft. Exact IDs avoid changing
// similarly worded stories in later editions.
const removed = new Set([
  '5c436006', 'ab3033d7', '867c9e06', '0fc06efb', 'c2b7d70d',
  'de857dfd', 'bf480651', '7da15b03', 'b6e51a10', 'a149714c',
  '99288951', '7f363714', 'bfdab0c2', '3e9e5d90', '573525df',
  '15c33c96', 'ea9a69e9', 'e70f878b', '7e18f356',
  '7ff6241a', 'd9196527', '249b36a2'
]);

const moved = new Map([
  ['7673b6cf', ['Miscellaneous', 'NORTH EAST ASIA', 'China']],
  ['e8f664ab', ['Miscellaneous', 'NORTH AMERICA', 'United States']],
  ['1b8154b2', ['Miscellaneous', 'NORTH AMERICA', 'United States']],
  ['46d5dd57', ['Miscellaneous', 'WESTERN / CENTRAL EUROPE', 'Netherlands']]
]);

const reviewedSummaries = new Map([
  ['b53e8c04', 'The envoys met European allies in Berlin to discuss support for Ukraine and postwar security guarantees.'],
  ['78d28f10', 'The leaders framed their readiness for talks as a show of support for Kyiv.'],
  ['e8f664ab', 'US officials say the California company had provided support to Ukraine.'],
  ['7ad7126d', 'He said adoption of the new constitution would complete his political mission.'],
  ['01aadd83', 'Parliamentary opposition factions say the referendum serves Baku’s interests and rejected his pledge as a political trap.'],
  ['3e0e9859', 'Student List MP Aleksandar Cupic was elected after the party’s victory in last month’s election.'],
  ['8b26c01d', 'Hashim Thaci was convicted of trying to tamper with prosecution witnesses after an earlier war crimes sentence.'],
  ['7b8e7402', 'EU delegation chief Luigi Soreca led the diplomats at the meeting.'],
  ['82eeb4bb', 'A leaked draft joint statement outlines the proposed formal talks.']
]);

export const expectedNativeDraft = '2026-11-19T19:51:51.917Z';

export function correctNativeEdition(edition, settings = {}) {
  if (edition?.checkedAt !== expectedNativeDraft || !Array.isArray(edition.articles))
    throw new Error('The shared edition is not the reviewed 19 November draft; no correction was published.');
  const ids = new Set(edition.articles.map(article => article.id));
  const missing = [...removed, ...moved.keys()].filter(id => !ids.has(id));
  if (missing.length) throw new Error(`Reviewed stories are absent (${missing.join(', ')}); no correction was published.`);
  const articles = edition.articles.filter(article => !removed.has(article.id)).map(article => {
    const placement = moved.get(article.id);
    const summary = reviewedSummaries.get(article.id) || conciseDnuSummary(article.summary, article.title);
    return {
      ...article,
      ...(placement ? { sectionId: placement[0], section: placement[0], subsection: placement[1], country: placement[2] } : {}),
      summary
    };
  });
  const keep = id => !removed.has(id);
  const nextSettings = {
    ...settings,
    articleEdits: Object.fromEntries(Object.entries(settings.articleEdits || {}).filter(([id]) => keep(id))),
    articleOrder: (settings.articleOrder || []).filter(keep),
    leadOrigins: Object.fromEntries(Object.entries(settings.leadOrigins || {}).filter(([id]) => keep(id)))
  };
  return { edition: { ...edition, articles, leadOrigins: Object.fromEntries(Object.entries(edition.leadOrigins || {}).filter(([id]) => keep(id))) }, settings: nextSettings,
    removed: [...removed], moved: [...moved.keys()] };
}
