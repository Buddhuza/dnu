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
  assert.equal(rejected[0].sourceName, 'BBC');
  assert.equal(rejected[0].sourceId, 'source-83');
  assert.equal(rejected[0].url, 'https://bbc.com/LIVE%3A%20US%20security%20talks%20begin');
  assert.equal(rejected[0].publishedAt, '2026-11-10T09:00:00Z');
  assert.equal(typeof rejected[0].summary, 'string');
});

test('native adapter drops a Guardian war briefing even when its title highlights one statement', () => {
  const { articles, rejected } = adaptSelectedArticles([
    item('Ukraine war briefing: Trump open to Kyiv getting Nato-like mutual defence guarantee, says Kushner',
      { source: 'Guardian', sourceDomain: 'theguardian.com' })
  ], new Set(), registry);
  assert.equal(articles.length, 0);
  assert.match(rejected[0].reason, /Multi-story war briefing/);
});

test('a saved editor decision overrides rejection and places the next matching story', () => {
  const candidate = item('LIVE: US security talks begin');
  const decision = { action: 'approve', title: candidate.headline, sourceName: 'BBC', url: candidate.link,
    sectionId: 'Miscellaneous', subsection: 'NORTH AMERICA', country: 'United States' };
  const result = adaptSelectedArticles([candidate], new Set(), registry, [decision]);
  assert.equal(result.rejected.length, 0);
  assert.equal(result.articles[0].editorialApproval, true);
  assert.equal(result.articles[0].country, 'United States');
  const deleted = adaptSelectedArticles([candidate], new Set(), registry, [{ ...decision, action: 'reject' }]);
  assert.equal(deleted.articles.length, 0);
  assert.equal(deleted.rejected[0].editorDecision, 'deleted');
});

test('DW live updates follow the official making the statement', () => {
  const titles = [
    'German defense minister open to talks with Russia',
    "Trump says Putin's his friend, not sure if he is a friend to America",
    'Moscow invites Germany France and UK for talks on Ukraine',
    'Trump says Putin will discuss Ukraine security'
  ];
  const candidates = titles.map(title => item(title, { source: 'DW', sourceDomain: 'dw.com', category: 'Eastern Europe', country: 'Ukraine' }));
  const { articles, rejected } = adaptSelectedArticles(candidates, new Set(), [...registry, { id: 'source-dw', domain: 'dw.com', name: 'DW', country: 'International' }]);
  assert.equal(rejected.length, 0);
  assert.deepEqual(articles.map(article => article.country), ['Germany', 'United States', 'Russia', 'United States']);
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

test('approved regional coverage and named international placements are retained', () => {
  const cases = [
    ['Belsat', 'belsat.eu', 'Belarus', 'Lukashenka confirms US raised issue of replenishing political prisoner exchange fund', 'Eastern Europe', 'Belarus', ''],
    ['BIRN', 'balkaninsight.com', 'Regional', 'Serbia Formally Drops Violent Overthrow Case Against Student Protesters', 'South Eastern Europe', 'Serbia', ''],
    ['Kabar', 'kabar.kg', 'Kyrgyzstan', 'Speakers of CIS parliaments meet with Gurbanguly Berdimuhamedov', 'Central Asia', 'Turkmenistan', ''],
    ['Trend', 'trend.az', 'Azerbaijan', 'Turkmenistan seeks CIS assembly observer status for parliament', 'Central Asia', 'Turkmenistan', ''],
    ['DTT', 'dtt-net.com', 'Regional', 'Albania Parliament approves 2027 budget draft-law in the first reading', 'South Eastern Europe', 'Albania', ''],
    ['Azertag', 'azertag.az', 'Azerbaijan', 'Russian MFA describes peace between Baku and Yerevan as a prerequisite for development in South Caucasus', 'South Caucasus', 'Azerbaijan', ''],
    ['Interfax', 'interfax.com', 'Russia', 'Turkmen parliament, Russian Federation Council sign cooperation plan for 2027', 'Central Asia', 'Turkmenistan', ''],
    ['Copenhagen Post', 'cphpost.dk', 'International', 'Trump, Xi and Putin agree on UN reform, energy supplies, international courts and nuclear weapons in joint peace declaration', 'Miscellaneous', 'NORTH EAST ASIA', 'China'],
    ['Ekathimerini', 'ekathimerini.com', 'International', 'Athens police bust suspected forgery lab producing fake asylum documents', 'Miscellaneous', 'WESTERN / CENTRAL EUROPE', 'Greece'],
    ['Reuters', 'reuters.com', 'International', 'Spanish police used excessive force during general strike, Amnesty says', 'Miscellaneous', 'WESTERN / CENTRAL EUROPE', 'Spain'],
    ['Demócrata', 'democrata.es', 'Spain', 'The Constitutional Court of Bosnia enrages the Bosnian Serbs by overturning the veto of its representative in the Presidency', 'South Eastern Europe', 'Bosnia and Herzegovina', ''],
    ['Reuters', 'reuters.com', 'International', 'Saudi-led forces strike Yemen port as Houthis warn airlines off the kingdom', 'Miscellaneous', 'MIDDLE EAST / NORTH AFRICA', 'Yemen']
  ];
  const sources = cases.map(([name, domain, country], index) => ({ id: `source-case-${index}`, name, domain, country }));
  const selected = cases.map(([name, domain, , title], index) => item(title, {
    source: name, sourceDomain: domain, link: `https://${domain}/article-${index}`
  }));
  const { articles, rejected } = adaptSelectedArticles(selected, new Set(), [...registry, ...sources]);
  assert.deepEqual(rejected.map(article => article.title), []);
  assert.deepEqual(articles.map(article => [article.sectionId, article.subsection, article.country]), cases.map(([, , , , section, subsection, country]) => [section, subsection, country]));
});

test('a minister offering condolences is still excluded', () => {
  const title = 'Education Minister offers condolences to the families of those killed in the Ponichala tragedy';
  const { articles, rejected } = adaptSelectedArticles([item(title, {
    source: '1TV.ge', sourceDomain: '1tv.ge', link: 'https://1tv.ge/article'
  })], new Set(), [...registry, { id: 'source-62', name: '1TV.ge', domain: '1tv.ge', country: 'Georgia' }]);
  assert.equal(articles.length, 0);
  assert.match(rejected[0].reason, /Condolence message/);
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
