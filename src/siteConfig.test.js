import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultSiteConfig, normalizeSiteConfig, displaySiteContent, displaySources, moveArticleInConfig, toggleLeadStoryInConfig, clearCustomArticlesInConfig } from './siteConfig.js';
import { MISCELLANEOUS_COUNTRIES } from './newsSections.js';

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

test('international organisation stories display in report priority order', () => {
  const countries = ['CSTO', 'NATO', 'BRICS', 'OSCE', 'IMF', 'CIS', 'UN', 'EU'];
  const stories = countries.map((country, index) => ({ id: String(index), url: `https://example.com/${index}`, section: 'Miscellaneous', subsection: 'INTERNATIONAL ORGANISATIONS', country, title: `${country} news`, sourceName: 'Agency' }));
  assert.deepEqual(displaySiteContent(stories, defaultSiteConfig(stories)).map(item => item.country), ['OSCE', 'EU', 'UN', 'NATO', 'IMF', 'CIS', 'CSTO', 'BRICS']);
});

test('star creates a lead heading and removing it restores the original placement after reload', () => {
  const stories = [{ id: 'armenia', section: 'South Caucasus', subsection: 'Armenia', title: 'Armenia signs regional deal', sourceName: 'Agency', url: 'https://example.com/armenia' }];
  const initial = defaultSiteConfig(stories);
  const starred = toggleLeadStoryInConfig(initial, stories, 'armenia');
  assert.deepEqual(displaySiteContent(stories, starred).map(item => [item.sectionId, item.subsection]), [['Lead stories', 'Armenia']]);
  assert.ok(starred.sections.find(section => section.id === 'Lead stories').subsections.includes('Armenia'));
  const restored = normalizeSiteConfig(JSON.parse(JSON.stringify(starred)), stories);
  const unstarred = toggleLeadStoryInConfig(restored, stories, 'armenia');
  assert.deepEqual(displaySiteContent(stories, unstarred).map(item => [item.sectionId, item.subsection]), [['South Caucasus', 'Armenia']]);
  assert.ok(!unstarred.sections.find(section => section.id === 'Lead stories').subsections.includes('Armenia'));
  assert.equal(unstarred.leadOrigins.armenia, undefined);
});

test('lead stories keep Ukraine then Middle East ahead of other headings', () => {
  const stories = [
    { id: 'me', section: 'Lead stories', subsection: 'Middle East', title: 'Iran story', sourceName: 'Agency', url: 'https://example.com/me' },
    { id: 'ua', section: 'Lead stories', subsection: 'Ukraine', title: 'Ukraine story', sourceName: 'Agency', url: 'https://example.com/ua' },
    { id: 'other', section: 'South Caucasus', subsection: 'Armenia', title: 'Armenia story', sourceName: 'Agency', url: 'https://example.com/other' }
  ];
  const config = toggleLeadStoryInConfig(defaultSiteConfig(stories), stories, 'other');
  config.sections.find(section => section.id === 'Lead stories').subsections = ['Armenia', 'Middle East', 'Ukraine'];
  assert.deepEqual(displaySiteContent(stories, config).map(item => item.subsection), ['Ukraine', 'Middle East', 'Armenia']);
});

test('removing an original Middle East lead creates its relevant country', () => {
  const stories = [{ id: 'saudi', section: 'Lead stories', subsection: 'Middle East', title: 'Houthis strike Saudi oil company Aramco', sourceName: 'Agency', url: 'https://example.com/saudi' }];
  const config = toggleLeadStoryInConfig(defaultSiteConfig(stories), stories, 'saudi');
  assert.deepEqual(displaySiteContent(stories, config).map(item => [item.sectionId, item.subsection, item.country]), [['Miscellaneous', 'MIDDLE EAST / NORTH AFRICA', 'Saudi Arabia']]);
  assert.ok(MISCELLANEOUS_COUNTRIES['MIDDLE EAST / NORTH AFRICA'].includes('Saudi Arabia'));
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

test('moving a story changes its section, subsection, and order after settings reload', () => {
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

test('moving a custom story into an empty subsection retains its new placement', () => {
  const config = defaultSiteConfig([]);
  config.customArticles = [{ id: 'manual-a', title: 'Custom', url: 'https://example.com/a', sectionId: 'Lead stories', subsection: 'Ukraine' }];
  const moved = moveArticleInConfig(config, [], 'manual-a', { sectionId: 'South Caucasus', subsection: 'Armenia', country: '' });
  assert.deepEqual(displaySiteContent([], normalizeSiteConfig(moved, []))[0].subsection, 'Armenia');
  assert.equal(moved.customArticles[0].sectionId, 'South Caucasus');
});

test('story duplicates are removed from the update and its download source', () => {
  const stories = [
    { id: 'first', url: 'https://example.com/article?utm_source=feed', section: 'South Caucasus', subsection: 'Azerbaijan', title: 'President hosts dinner for participants of CICA summit (PHOTO)', sourceName: 'Agency A' },
    { id: 'same-url', url: 'https://www.example.com/article/', section: 'South Caucasus', subsection: 'Azerbaijan', title: 'Completely different metadata title', sourceName: 'Agency B' },
    { id: 'same-story', url: 'https://other.example.com/story', section: 'South Caucasus', subsection: 'Azerbaijan', title: 'President hosts dinner for participants of CICA summit', sourceName: 'Agency C' },
    { id: 'different-country', url: 'https://example.com/other', section: 'South Caucasus', subsection: 'Armenia', title: 'President hosts dinner for participants of CICA summit', sourceName: 'Agency D' }
  ];
  assert.deepEqual(displaySiteContent(stories, defaultSiteConfig(stories)).map(item => item.id), ['different-country', 'first']);
  assert.deepEqual(displaySiteContent(stories, defaultSiteConfig(stories), new Set(['first'])).map(item => item.id), ['different-country', 'same-url']);
});

test('similar diplomatic headlines about different countries remain separate', () => {
  const stories = [
    { id: 'tajik', section: 'South Caucasus', subsection: 'Azerbaijan', title: 'President Ilham Aliyev met with President of Tajikistan', sourceName: 'Agency A' },
    { id: 'uzbek', section: 'South Caucasus', subsection: 'Azerbaijan', title: 'President Ilham Aliyev met with President of Uzbekistan', sourceName: 'Agency B' }
  ];
  assert.equal(displaySiteContent(stories, defaultSiteConfig(stories)).length, 2);
});

test('one planned diplomatic trip appears once even across sections and source wording', () => {
  const stories = [
    { id: 'local', section: 'Central Asia', subsection: 'Uzbekistan', title: 'Rubio to visit India, Uzbekistan', sourceName: 'Pajhwok', publishedAt: '2026-10-14T09:19:00Z' },
    { id: 'local-two', section: 'Miscellaneous', subsection: 'NORTH AMERICA', country: 'United States', title: 'US Secretary of State Marco Rubio to visit Uzbekistan this week', sourceName: 'Kun.uz', publishedAt: '2026-10-14T11:45:00Z' },
    { id: 'international', section: 'Miscellaneous', subsection: 'NORTH AMERICA', country: 'United States', title: 'US top diplomat Marco Rubio to visit India and Uzbekistan', sourceName: 'AsiaOne', publishedAt: '2026-10-14T02:43:00Z' },
    { id: 'different-trip', section: 'Miscellaneous', subsection: 'NORTH AMERICA', country: 'United States', title: 'Marco Rubio to visit Japan and China', sourceName: 'AP', publishedAt: '2026-10-14T04:00:00Z' }
  ];
  assert.deepEqual(displaySiteContent(stories, defaultSiteConfig(stories)).map(item => item.id), ['international', 'different-trip']);
});

test('published update has one Rubio visit story from the preferred source', () => {
  const update = JSON.parse(readFileSync(new URL('../data/daily-update-2026-10-14-15.json', import.meta.url), 'utf8'));
  const visits = update.articles.filter(article => /Rubio.*\bvisit\b/i.test(article.title));
  assert.deepEqual(visits.map(article => article.sourceName), ['AsiaOne']);
});

test('a manually added version replaces a matching snapshot story', () => {
  const stories = [{ id: 'snapshot', section: 'Eastern Europe', subsection: 'Ukraine', title: 'Ukraine and Germany agree on new security cooperation', url: 'https://example.com/original', sourceName: 'Agency' }];
  const config = defaultSiteConfig(stories);
  config.customArticles = [{ id: 'manual-new', sourceId: 'manual', sectionId: 'Eastern Europe', subsection: 'Ukraine', title: 'Ukraine and Germany agree on new security cooperation', url: 'https://example.org/alternate', sourceName: 'Another agency' }];
  assert.deepEqual(displaySiteContent(stories, config).map(item => item.id), ['manual-new']);
});

test('similar headlines from different dates remain separate', () => {
  const stories = [
    { id: 'recent', section: 'Eastern Europe', subsection: 'Ukraine', title: 'Ukraine and Germany agree on new security cooperation', publishedAt: '2026-10-14T12:00:00Z' },
    { id: 'old', section: 'Eastern Europe', subsection: 'Ukraine', title: 'Ukraine and Germany agree on new security cooperation', publishedAt: '2024-10-14T12:00:00Z' }
  ];
  assert.equal(displaySiteContent(stories, defaultSiteConfig(stories)).length, 2);
});

test('moving to a new regional country and organisation persists across reload', () => {
  const stories = [{ id: 'one', section: 'Eastern Europe', subsection: 'Ukraine', title: 'One' }, { id: 'two', section: 'Miscellaneous', subsection: 'INTERNATIONAL ORGANISATIONS', country: 'OSCE', title: 'Two' }];
  const initial = defaultSiteConfig(stories);
  const regional = moveArticleInConfig(initial, stories, 'one', { sectionId: 'South Eastern Europe', subsection: 'New country', country: '', createSubsection: true });
  const organisation = moveArticleInConfig(regional, stories, 'two', { sectionId: 'Miscellaneous', subsection: 'INTERNATIONAL ORGANISATIONS', country: 'New organisation', createCountry: true });
  const restored = normalizeSiteConfig(organisation, stories);
  assert.ok(restored.sections.find(item => item.id === 'South Eastern Europe').subsections.includes('New country'));
  assert.ok(restored.customCountries['INTERNATIONAL ORGANISATIONS'].includes('New organisation'));
  assert.deepEqual(displaySiteContent(stories, restored).map(item => [item.id, item.subsection, item.country]), [
    ['one', 'New country', ''], ['two', 'INTERNATIONAL ORGANISATIONS', 'New organisation']
  ]);
});

test('moving the last story removes empty headings and unused custom destinations', () => {
  const stories = [{ id: 'one', section: 'Eastern Europe', subsection: 'Ukraine', title: 'One' }, { id: 'two', section: 'Miscellaneous', subsection: 'INTERNATIONAL ORGANISATIONS', country: 'OSCE', title: 'Two' }];
  let config = defaultSiteConfig(stories);
  config = moveArticleInConfig(config, stories, 'one', { sectionId: 'South Caucasus', subsection: 'New country', country: '', createSubsection: true });
  config = moveArticleInConfig(config, stories, 'two', { sectionId: 'Miscellaneous', subsection: 'INTERNATIONAL ORGANISATIONS', country: 'New organisation', createCountry: true });
  config = moveArticleInConfig(config, stories, 'one', { sectionId: 'Eastern Europe', subsection: 'Ukraine', country: '' });
  config = moveArticleInConfig(config, stories, 'two', { sectionId: 'Miscellaneous', subsection: 'INTERNATIONAL ORGANISATIONS', country: 'OSCE' });
  assert.ok(!config.sections.find(item => item.id === 'South Caucasus').subsections.includes('New country'));
  assert.ok(!config.customCountries['INTERNATIONAL ORGANISATIONS']?.includes('New organisation'));
  assert.deepEqual(displaySiteContent(stories, normalizeSiteConfig(config, stories)).map(item => [item.sectionId, item.subsection, item.country]), [
    ['Eastern Europe', 'Ukraine', ''], ['Miscellaneous', 'INTERNATIONAL ORGANISATIONS', 'OSCE']
  ]);
});

test('moving the sole story out of a custom section removes that section', () => {
  const stories = [{ id: 'one', section: 'Eastern Europe', subsection: 'Ukraine', title: 'One' }];
  const config = defaultSiteConfig(stories);
  config.sections.push({ id: 'Custom section', name: 'Custom section', visible: true, subsections: ['Country'] });
  const custom = moveArticleInConfig(config, stories, 'one', { sectionId: 'Custom section', subsection: 'Country', country: '' });
  const moved = moveArticleInConfig(custom, stories, 'one', { sectionId: 'Eastern Europe', subsection: 'Ukraine', country: '' });
  assert.ok(!moved.sections.some(item => item.id === 'Custom section'));
});

test('a new scrape removes manually added stories without discarding site settings or prepared story edits', () => {
  const config = defaultSiteConfig([]);
  config.customArticles = [{ id: 'manual-old', url: 'https://example.com/old', title: 'Older imported story' }];
  config.articleOrder = ['manual-old', 'prepared-story'];
  config.articleEdits = { 'manual-old': { title: 'Edited import' }, 'prepared-story': { title: 'Edited prepared story' } };
  config.leadOrigins = { 'manual-old': { sectionId: 'South Caucasus', subsection: 'Georgia' } };
  config.darkMode = true;
  const cleared = clearCustomArticlesInConfig(config);
  assert.deepEqual(cleared.customArticles, []);
  assert.deepEqual(cleared.articleOrder, ['prepared-story']);
  assert.deepEqual(cleared.articleEdits, { 'prepared-story': { title: 'Edited prepared story' } });
  assert.deepEqual(cleared.leadOrigins, {});
  assert.equal(cleared.darkMode, true);
  assert.equal(clearCustomArticlesInConfig(cleared), cleared);
});
