import test from 'node:test';
import assert from 'node:assert/strict';
import { excludedHeadlineReason } from './headlinePolicy.js';
import { cleanHeadlinePrefix } from './headlineText.js';
import { displaySourceName } from './sourceNames.js';
import { convertSpreadsheetRows } from './spreadsheetImport.js';
import { defaultSiteConfig, displaySiteContent } from './siteConfig.js';

test('automatic import excludes the specific non-news and paywalled examples', () => {
  const titles = [
    'Energy Efficiency in the Western Balkans: Building Markets and Creating Jobs',
    'INTERVIEW: John Bolton: Stability of BiH Is Crucial for the Balkans',
    'CESEC: Europe is spending enormous sums on high energy costs',
    'US-Israel-Iran War',
    '- politico.eu (Politico.eu) 7 Nov 26',
    '- politico.eu'
  ];
  for (const title of titles) assert.ok(excludedHeadlineReason(title), title);
  const paywalled = { id: 'bloomberg', section: 'South Eastern Europe', subsection: 'Albania', sourceName: 'Bloomberg', title: 'Albania Protests Turn Violent as Pressure on PM Continues', url: 'https://www.bloomberg.com/news/articles/example' };
  assert.deepEqual(displaySiteContent([paywalled], defaultSiteConfig([paywalled])), []);
  const rows = [{ rowNumber: 1, source: 'World Bank', heading: titles[0], url: 'https://worldbank.org/en/news/example', region: 'South Eastern Europe', countries: 'Albania' }];
  assert.equal(convertSpreadsheetRows(rows).articles.length, 0);
});

test('decorative headline symbols and agency labels are cleaned for display', () => {
  assert.equal(cleanHeadlinePrefix('🔴 At least five people killed in shooting in Krakow, Polish police say ⤵️'), 'At least five people killed in shooting in Krakow, Polish police say');
  const names = { 'vreme.com': 'Vreme', 'AOL.com': 'AOL', 'NIN.rs': 'NIN', 'euroradio.fm': 'Euroradio', 'Pan Armenian': 'PAN', 'Novinite.com': 'Novinite', 'ABNA English': 'ABNA24', 'Committee to Protect Journalists': 'CPJ', 'Financial Times': 'FT', 'Times of Central Asia': 'TCA', 'https://aapnews.aap.com.au/': 'AAP' };
  for (const [input, expected] of Object.entries(names)) assert.equal(displaySourceName(input), expected);
  assert.equal(displaySourceName('Yahoo', { body: 'The report was issued by dpa on Monday.' }), 'dpa');
  assert.equal(displaySourceName('Yahoo', { body: 'This report has no original agency credit.' }), 'Yahoo');
});
