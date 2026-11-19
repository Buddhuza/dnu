import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptSelectedArticles, dedupeNativeEvents, limitBelarusStateAgency } from './dnuEdition.js';

const registry = [{ id: 'source-83', domain: 'bbc.com', name: 'BBC' }];
const item = (title, extras = {}) => ({
  id: title, headline: title, description: '', publicSummary: 'Ministers discussed security arrangements.',
  published: '2026-11-10T09:00:00Z', source: 'BBC', sourceDomain: 'bbc.com',
  link: 'https://bbc.com/' + encodeURIComponent(title), category: 'International', country: '',
  articleBody: 'Ministers discussed security arrangements and agreed to hold further talks next month. '.repeat(5),
  ...extras
});

test('native articles use DNU country and lead headings with stable source IDs', () => {
  const selected = [
    item('Trump announces new US security talks', { country: 'United States' }),
    item('Ukraine peace talks resume', { category: 'Eastern Europe', country: 'Ukraine' })
  ];
  const { articles, rejected } = adaptSelectedArticles(selected, new Set([selected[1].id]), registry);
  assert.equal(rejected.length, 0);
  assert.deepEqual(articles.map(article => [article.sectionId, article.subsection, article.country]), [
    ['Miscellaneous', 'NORTH AMERICA', 'United States'], ['Lead stories', 'Ukraine', '']
  ]);
  assert.equal(articles[0].sourceId, 'source-83');
  assert.ok(articles[0].body.length > 25);
});

test('native adapter drops live blogs and direct OSCE publications', () => {
  const { articles, rejected } = adaptSelectedArticles([
    item('LIVE: US security talks begin'),
    item('OSCE statement on regional security', { source: 'OSCE', sourceDomain: 'osce.org', link: 'https://news.google.com/rss/articles/example' })
  ], new Set(), registry);
  assert.equal(articles.length, 0);
  assert.match(rejected[0].reason, /Live blogs/);
  assert.match(rejected[1].reason, /OSCE publication/);
});

test('native event deduplication keeps the international account of a repeated event', () => {
  const stories = [
    { id: 'regional', title: 'Hegseth faces impeachment effort over Iran war', sourceName: 'Gazeta Express', body: '', subsection: 'NORTH AMERICA' },
    { id: 'international', title: 'US defence chief Hegseth faces impeachment push', sourceName: 'DW', body: 'A full article body.', subsection: 'NORTH AMERICA' }
  ];
  const result = dedupeNativeEvents(stories);
  assert.deepEqual(result.articles.map(article => article.id), ['international']);
  assert.equal(result.removed.length, 1);
});

test('routine traffic crashes do not appear under a regional outlet', () => {
  const { articles, rejected } = adaptSelectedArticles([
    item('At least 5 students killed, 21 injured in Cambodia bus crash', {
      source: 'News.az', sourceDomain: 'news.az', country: 'Azerbaijan', category: 'South Caucasus Region'
    })
  ], new Set(), [...registry, { id: 'source-58', domain: 'news.az', name: 'News.az', country: 'Azerbaijan' }]);
  assert.equal(articles.length, 0);
  assert.equal(rejected.length, 1);
});

test('native adapter strips a publisher teaser and relative timestamp from a headline', () => {
  const { articles } = adaptSelectedArticles([item('UK to provide Ukraine with 1,000 long-range strike drones The prime minister made the announcement at a meeting in Berlin. 2 hrs ago UK', {
    category: 'Eastern Europe', country: 'Ukraine'
  })], new Set(), registry);
  assert.equal(articles[0].title, 'UK to provide Ukraine with 1,000 long-range strike drones');
});

test('native placement follows the event, not the publisher home', () => {
  const cases = [
    ['China’s Xi urges US and Russia to join forces to safeguard world peace', 'Al Jazeera', 'aljazeera.com', 'NORTH EAST ASIA', 'China'],
    ['Alleged Russian agent arrested for spying on Silicon Valley tech firm', 'Euronews', 'euronews.com', 'NORTH AMERICA', 'United States'],
    ['Asylum minister reaffirms Syria is safe despite Council of State ruling', 'NL Times', 'nltimes.nl', 'WESTERN / CENTRAL EUROPE', 'Netherlands']
  ];
  const sources = cases.map(([, name, domain], index) => ({ id: `source-${200 + index}`, name, domain }));
  const { articles, rejected } = adaptSelectedArticles(cases.map(([title, name, domain]) => item(title, {
    source: name, sourceDomain: domain, link: `https://${domain}/article`, category: 'South Caucasus Region', country: 'Azerbaijan'
  })), new Set(), [...registry, ...sources]);
  assert.deepEqual(rejected, []);
  assert.deepEqual(articles.map(article => [article.subsection, article.country]), cases.map(([, , , subsection, country]) => [subsection, country]));
});

test('local sources do not place foreign events under their home countries', () => {
  const sources = [
    ['News.az', 'news.az', 'Azerbaijan', 'Haiti police report 34 gang suspects killed in capital raid'],
    ['Radio Moldova', 'radiomoldova.md', 'Moldova', 'Putin warns of painful response after third Crimea bridge strike'],
    ['Gazeta Express', 'gazetaexpress.com', 'Serbia / Kosovo', 'Xi calls for a world without nuclear weapons in meeting with Trump and Putin']
  ];
  const registryWithSources = sources.map(([name, domain, country], index) => ({ id: `source-${220 + index}`, name, domain, country }));
  const { articles, rejected } = adaptSelectedArticles(sources.map(([titleName, domain, country, title]) => item(title, {
    source: titleName, sourceDomain: domain, link: `https://${domain}/article`, category: 'South Caucasus Region', country
  })), new Set(), [...registry, ...registryWithSources]);
  assert.equal(articles.length, 0);
  assert.equal(rejected.length, 3);
});

test('Belarus state agency coverage is limited within one edition', () => {
  const result = limitBelarusStateAgency([
    { id: 'a', sourceName: 'BelTA', sectionId: 'Eastern Europe', subsection: 'Belarus' },
    { id: 'b', sourceName: 'BelTA', sectionId: 'Eastern Europe', subsection: 'Belarus' },
    { id: 'c', sourceName: 'Euroradio', sectionId: 'Eastern Europe', subsection: 'Belarus' }
  ]);
  assert.deepEqual(result.articles.map(article => article.id), ['a', 'c']);
  assert.deepEqual(result.removed.map(article => article.id), ['b']);
});
