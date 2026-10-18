import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { preferredRegionalPlacement, sourceHomeCountry, ukraineAttackPlacement, russianTerritoryAttackPlacement } from './storyPlacement.js';

test('attacks taking place in Ukraine are placed by location rather than the first country named', () => {
  const ukraine = { sectionId: 'Eastern Europe', subsection: 'Ukraine', country: '' };
  assert.deepEqual(ukraineAttackPlacement('Russia bombs Ukraine overnight'), ukraine);
  assert.deepEqual(ukraineAttackPlacement('Russian drones strike Kyiv energy network'), ukraine);
  assert.deepEqual(ukraineAttackPlacement('Strike on Kyiv kills three'), ukraine);
  assert.equal(ukraineAttackPlacement('Ukrainian drones attack Belgorod in Russia'), null);
  assert.equal(ukraineAttackPlacement('EU pledges military aid to Ukraine'), null);
});

test('Ukrainian strikes on St Petersburg belong under Russia', () => {
  const russia = { sectionId: 'Miscellaneous', subsection: 'RUSSIA / EURASIA', country: 'Russia' };
  assert.deepEqual(russianTerritoryAttackPlacement('Ukraine strikes oil facility in St Petersburg'), russia);
  assert.deepEqual(russianTerritoryAttackPlacement('St Petersburg oil facilities ablaze as Ukraine launches drones'), russia);
  assert.equal(russianTerritoryAttackPlacement('Russian drones strike Kyiv energy network'), null);
});

test('a PAN story about Mirzoyan and Kosovo belongs under Armenia', () => {
  const story = {
    sourceId: 'source-47', url: 'https://www.pan.am/en/626315',
    title: 'Mirzoyan discusses bilateral issues with Kosovo’s official',
    summary: 'Armenian Foreign Minister Ararat Mirzoyan met Kosovo’s deputy prime minister.'
  };
  assert.equal(sourceHomeCountry(story), 'Armenia');
  assert.deepEqual(preferredRegionalPlacement(story, { sectionId: 'South Eastern Europe', subsection: 'Serbia / Kosovo', country: '' }),
    { sectionId: 'South Caucasus', subsection: 'Armenia', country: '' });
});

test('multi-country stories follow a participating outlet country across regional sections', () => {
  const article = { sourceId: 'source-75', url: 'https://en.kabar.kg/news/example', title: 'Kyrgyz president visits Azerbaijan', summary: 'The two governments will discuss security cooperation.' };
  assert.deepEqual(preferredRegionalPlacement(article, { sectionId: 'South Caucasus', subsection: 'Azerbaijan', country: '' }),
    { sectionId: 'Central Asia', subsection: 'Kyrgyzstan', country: '' });
});

test('publisher suffixes and outlets without a participating home country do not redirect a story', () => {
  const placement = { sectionId: 'South Eastern Europe', subsection: 'Montenegro', country: '' };
  const article = { sourceId: 'source-4', url: 'https://euronews.al/en/article', sourceName: 'Euronews.al', title: 'Croatia sets conditions for Montenegro - Euronews Albania', summary: 'Montenegro must meet several conditions before accession.' };
  assert.equal(preferredRegionalPlacement(article, placement), placement);
  assert.equal(preferredRegionalPlacement({ ...article, sourceId: 'source-2', url: 'https://balkaninsight.com/article' }, placement), placement);
});

test('the current edition files the Mirzoyan and Kosovo story under Armenia', () => {
  const update = JSON.parse(readFileSync(new URL('../data/daily-update-2026-10-14-15.json', import.meta.url), 'utf8'));
  const story = update.articles.find(article => article.url === 'https://www.pan.am/en/626315');
  assert.deepEqual([story.section, story.subsection], ['South Caucasus', 'Armenia']);
  assert.ok(update.articles.every(article => {
    const placement = preferredRegionalPlacement(article, { sectionId: article.section, subsection: article.subsection, country: article.country });
    return placement.sectionId === article.section && placement.subsection === article.subsection;
  }));
});
