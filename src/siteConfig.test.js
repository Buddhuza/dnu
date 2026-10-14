import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSiteConfig, normalizeSiteConfig, displaySiteContent, displaySources, moveArticleInConfig } from './siteConfig.js';

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

test('countries stay alphabetical even when a manually added story has a later article order', () => {
  const stories = [
    { id: 'uk', section: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'United Kingdom', title: 'UK story' },
    { id: 'italy', section: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'Italy', title: 'Italy story' },
    { id: 'germany', section: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'Germany', title: 'Germany story' }
  ];
  const config = defaultSiteConfig(stories);
  config.articleOrder = ['uk', 'italy', 'germany'];
  config.customArticles = [{ id: 'manual-italy', title: 'New Italy story', url: 'https://example.com/italy', sourceName: 'Agency', sectionId: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'Italy' }];
  assert.deepEqual(displaySiteContent(stories, config).map(item => item.country), ['Germany', 'Italy', 'Italy', 'United Kingdom']);
});

test('headline, empty summary, and agency edits survive saved settings', () => {
  const config = defaultSiteConfig(articles);
  config.articleEdits.a = { title: 'Edited headline', summary: '', summaryEdited: true, sourceName: 'New agency', sectionId: 'Europe', subsection: 'Poland' };
  const restored = normalizeSiteConfig(config, articles);
  const story = displaySiteContent(articles, restored).find(item => item.id === 'a');
  assert.equal(story.title, 'Edited headline');
  assert.equal(story.summary, '');
  assert.equal(story.sourceName, 'New agency');
});

test('old text-only edits restore the original country and subsection', () => {
  const stories = [{ id: 'italy', section: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'Italy', title: 'Original', sourceName: 'Agency' }];
  const config = normalizeSiteConfig({ ...defaultSiteConfig(stories), articleEdits: { italy: { title: 'Edited', summary: '', summaryEdited: true, sourceName: 'New agency', sectionId: '', subsection: '', country: '' } } }, stories);
  const [story] = displaySiteContent(stories, config);
  assert.equal(story.subsection, 'WESTERN / CENTRAL EUROPE');
  assert.equal(story.country, 'Italy');
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

test('estimated import time remains identified after browser settings reload', () => {
  const config = normalizeSiteConfig({ version: 1, customArticles: [{ id: 'manual-estimated', title: 'OSCE chair visits Armenia', url: 'https://example.com/article', sourceName: 'Agency', summary: 'The chair met the foreign minister.', sectionId: 'South Caucasus', subsection: 'Armenia', publishedAt: '2026-10-13T10:00:00Z', timeSource: 'inferred' }] }, []);
  assert.equal(config.customArticles[0].timeSource, 'inferred');
  assert.equal(displaySiteContent([], config)[0].timeSource, 'inferred');
});

test('dragging a story changes its section, subsection, and order after settings reload', () => {
  const stories = [
    { id: 'one', section: 'Lead stories', subsection: 'Ukraine', title: 'One' },
    { id: 'two', section: 'Lead stories', subsection: 'Ukraine', title: 'Two' },
    { id: 'three', section: 'Eastern Europe', subsection: 'Belarus', country: 'Minsk', title: 'Three' }
  ];
  const config = defaultSiteConfig(stories);
  const moved = moveArticleInConfig(config, stories, 'three', { sectionId: 'Lead stories', subsection: 'Ukraine', country: '', anchorId: 'one', after: true });
  assert.deepEqual(displaySiteContent(stories, normalizeSiteConfig(moved, stories)).map(item => [item.id, item.section, item.subsection]), [
    ['one', 'Lead stories', 'Ukraine'], ['three', 'Lead stories', 'Ukraine'], ['two', 'Lead stories', 'Ukraine']
  ]);
  assert.equal(displaySiteContent(stories, normalizeSiteConfig(moved, stories))[1].country, '');
  assert.equal(stories[2].section, 'Eastern Europe');
});

test('dragging a custom story into an empty subsection retains its new placement', () => {
  const config = defaultSiteConfig([]);
  config.customArticles = [{ id: 'manual-a', title: 'Custom', url: 'https://example.com/a', sectionId: 'Lead stories', subsection: 'Ukraine' }];
  const moved = moveArticleInConfig(config, [], 'manual-a', { sectionId: 'South Caucasus', subsection: 'Armenia', country: '' });
  assert.deepEqual(displaySiteContent([], normalizeSiteConfig(moved, []))[0].subsection, 'Armenia');
  assert.equal(moved.customArticles[0].sectionId, 'South Caucasus');
});
