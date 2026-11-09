import test from 'node:test';
import assert from 'node:assert/strict';
import { editorialPlacement } from './editorialPlacement.js';
import { excludedHeadlineReason } from './headlinePolicy.js';
import { displaySourceName } from './sourceNames.js';
import { reviewPublishedEdition } from './editorialEdition.js';
import { defaultSiteConfig, displaySiteContent } from './siteConfig.js';

test('political statements follow the speaker and event location', () => {
  const cases = [
    ['Tokayev outlines key areas of cooperation with Tajikistan', 'Central Asia', 'Kazakhstan', ''],
    ["Rubio says Trump's war against Iran not 'necessarily popular' but needed to stop a nuclear threat", 'Miscellaneous', 'NORTH AMERICA', 'United States'],
    ['Trump says strikes unlikely if peace talks keep moving', 'Miscellaneous', 'NORTH AMERICA', 'United States'],
    ['Trump says he is unlikely to order Iran attack if talks progress, CNN reports', 'Miscellaneous', 'NORTH AMERICA', 'United States'],
    ['Trump teases ‘big, beautiful’ European security deal after meeting Putin envoy', 'Miscellaneous', 'NORTH AMERICA', 'United States'],
    ['Baku’s joy is Ankara’s pride, and Shusha’s pride is pride of our entire nation – Turkish President', 'South Caucasus', 'Azerbaijan', ''],
    ['French presidential candidate pledges to enforce ICC arrest warrant for Netanyahu if elected', 'Miscellaneous', 'WESTERN / CENTRAL EUROPE', 'France'],
    ['Among those killed, wounded in Krakow shooting citizens of Russia, other states — ministry', 'Miscellaneous', 'WESTERN / CENTRAL EUROPE', 'Poland']
  ];
  for (const [title, sectionId, subsection, country] of cases) assert.deepEqual(editorialPlacement(title), { sectionId, subsection, country }, title);
});

test('analysis, lifestyle, traffic and abuse headlines are outside the automatic brief', () => {
  for (const title of [
    'With Change of Power, Serbia Can Reinvigorate EU Accession Bid',
    'Attempts to find resolution for Israel’s new government and Ukraine’s war',
    'Kazakhstan approves ban on single-use plastic tableware',
    'Diwali celebrated in Bishkek',
    'How a university boom fuels exploitation and human trafficking',
    'Motorcyclists account for 38% of Cyprus road deaths',
    'School bus accident leaves several injured',
    'Police investigate child sex abuse'
  ]) assert.ok(excludedHeadlineReason(title), title);
  assert.equal(displaySourceName('Civil ge'), 'Civil.ge');
});

test('a Russian outlet report on a Krakow shooting is removed rather than filed under Poland', () => {
  const article = { id: 'krakow', sourceName: 'TASS', url: 'https://news.google.com/rss/articles/example', title: 'Among those killed, wounded in Krakow shooting citizens of Russia, other states — ministry', sectionId: 'Miscellaneous', subsection: 'RUSSIA / EURASIA', country: 'Russia' };
  const result = reviewPublishedEdition({ articles: [article] }, {});
  assert.equal(result.edition.articles.length, 0);
  assert.match(result.removed[0].reason, /Russian outlet restricted/);
});

test('a corrected Kazakhstan placement stays put when the website displays the imported story', () => {
  const article = { id: 'tokayev', sourceName: 'Reuters', url: 'https://example.com/story', title: 'Tokayev outlines key areas of cooperation with Tajikistan', sectionId: 'Central Asia', section: 'Central Asia', subsection: 'Tajikistan', country: '', fromSpreadsheet: true };
  const reviewed = reviewPublishedEdition({ articles: [article] }, defaultSiteConfig([article]));
  assert.equal(reviewed.edition.articles[0].editorialPlacementLocked, true);
  assert.equal(displaySiteContent(reviewed.edition.articles, reviewed.settings)[0].subsection, 'Kazakhstan');
});
