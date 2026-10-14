import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSiteConfig, normalizeSiteConfig, displaySiteContent, displaySources } from './siteConfig.js';

const articles = [
  { id: 'a', section: 'Europe', subsection: 'Poland', title: 'Original headline', summary: 'Original summary.', sourceName: 'Agency', url: 'https://example.com/a' },
  { id: 'b', section: 'Asia', subsection: 'Japan', title: 'Second headline', summary: 'Second summary.', sourceName: 'Agency', url: 'https://example.com/b' }
];

test('default reading text starts at 18 px', () => {
  assert.equal(defaultSiteConfig(articles).fontSize, 18);
});

test('section edits reorder, rename, and hide news without changing source data', () => {
  const config = defaultSiteConfig(articles);
  config.sections = [{ id: 'Asia', name: 'Asia Pacific', visible: true }, { id: 'Europe', name: 'Europe', visible: false }];
  config.articleEdits.b = { title: 'Edited headline', summary: 'New detail.', sectionId: 'Asia', subsection: 'Japan', hidden: false };
  const displayed = displaySiteContent(articles, config);
  assert.deepEqual(displayed.map(item => item.title), ['Edited headline']);
  assert.equal(displayed[0].section, 'Asia Pacific');
  assert.equal(articles[1].title, 'Second headline');
});

test('import rejects unsafe links and invalid colors', () => {
  const config = normalizeSiteConfig({
    version: 1,
    theme: { primary: 'red; background: black' },
    customArticles: [{ title: 'Unsafe', url: 'javascript:alert(1)' }]
  }, articles);
  assert.equal(config.theme.primary, '#123e47');
  assert.equal(config.customArticles.length, 0);
  assert.equal(config.sections.length, 8);
  assert.ok(config.sections.some(section => section.id === 'Miscellaneous' && section.subsections.includes('INTERNATIONAL ORGANISATIONS')));
});

test('custom sources, visibility, and dark appearance survive settings import', () => {
  const config = normalizeSiteConfig({
    ...defaultSiteConfig(articles),
    darkMode: true,
    fontSize: 17,
    customSources: [{ id: 'manual-source-test-1', name: 'New outlet', group: 'Europe', url: 'https://example.com/news' }],
    hiddenSourceIds: ['provided']
  }, articles);
  assert.equal(config.darkMode, true);
  assert.equal(config.fontSize, 17);
  assert.deepEqual(displaySources([{ id: 'provided', name: 'Old outlet' }], config).map(item => item.name), ['New outlet']);
});

test('a provided source can use a reviewed collection page on the same website', () => {
  const config = normalizeSiteConfig({ version: 1, sourceListingOverrides: { 'source-1': 'https://example.com/politics', 'source-2': 'javascript:alert(1)' } }, articles);
  const displayed = displaySources([{ id: 'source-1', name: 'Example', url: 'https://example.com/' }, { id: 'source-2', name: 'Other', url: 'https://other.com/' }], config);
  assert.equal(displayed[0].listingUrl, 'https://example.com/politics');
  assert.equal(displayed[1].listingUrl, undefined);
});

test('old organisation stories move into Miscellaneous', () => {
  const article = { ...articles[0], section: 'Lead stories', subsection: 'International organisations' };
  const config = normalizeSiteConfig({
    version: 1,
    customArticles: [{ id: 'manual-org', title: 'OSCE meeting', url: 'https://example.com/osce', sourceName: 'Agency', sectionId: 'International organisations', subsection: 'OSCE' }]
  }, [article]);
  const displayed = displaySiteContent([article], config);
  assert.deepEqual(displayed.map(item => [item.section, item.subsection]), [
    ['Miscellaneous', 'INTERNATIONAL ORGANISATIONS'],
    ['Miscellaneous', 'INTERNATIONAL ORGANISATIONS']
  ]);
});
