import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureUkraineWarLeads, selectWeekendStories, viennaSchedule, weekendSheetReadiness } from './weekendEdition.js';

test('weekend duplicates retain the international agency account', () => {
  const local = { id: 'local', sourceName: 'Tirana Times', title: 'Albania PM resigns after corruption protests in Tirana', publishedAt: '2026-11-07T08:00:00Z' };
  const global = { id: 'global', sourceName: 'Reuters', title: 'Albania PM resigns after corruption protests in Tirana', publishedAt: '2026-11-07T09:00:00Z' };
  const other = { id: 'other', sourceName: 'N1', title: 'Serbia and Kosovo agree new border crossing', publishedAt: '2026-11-07T09:00:00Z' };
  const result = selectWeekendStories([local, other, global]);
  assert.deepEqual(result.articles.map(article => article.id), ['global', 'other']);
  assert.equal(result.removed[0].preferred.id, 'global');
});

test('widely covered hard news can become a lead outside Ukraine and the Middle East', () => {
  const base = { publishedAt: '2026-11-07T09:00:00Z', title: 'Albanian PM resigns after major protests in Tirana', sectionId: 'South Eastern Europe', subsection: 'Albania', country: '' };
  const result = selectWeekendStories([
    { ...base, id: 'local', sourceName: 'Tirana Times', url: 'https://tiranatimes.com/a' },
    { ...base, id: 'global', sourceName: 'Reuters', url: 'https://reuters.com/a' },
    { ...base, id: 'third', sourceName: 'AP', url: 'https://apnews.com/a' }
  ]);
  assert.equal(result.articles.length, 1);
  assert.equal(result.articles[0].sectionId, 'Lead stories');
  assert.equal(result.articles[0].subsection, 'Albania');
  assert.equal(result.promoted[0].sourceCount, 3);
  assert.deepEqual(result.leadOrigins[result.articles[0].id], { sectionId: 'South Eastern Europe', subsection: 'Albania', country: '' });
});

test('Middle East lead candidates share one lead heading, while repeated agency copies do not count', () => {
  const base = { publishedAt: '2026-11-07T09:00:00Z', title: 'Iran agrees ceasefire after regional talks', sectionId: 'Miscellaneous', subsection: 'MIDDLE EAST / NORTH AFRICA', country: 'Iran' };
  const multi = selectWeekendStories([
    { ...base, id: 'one', sourceName: 'Reuters', url: 'https://reuters.com/a' },
    { ...base, id: 'two', sourceName: 'AP', url: 'https://apnews.com/a' },
    { ...base, id: 'three', sourceName: 'AFP', url: 'https://afp.com/a' }
  ]);
  assert.equal(multi.articles[0].subsection, 'Middle East');
  const sameAgency = selectWeekendStories([
    { ...base, id: 'one', sourceName: 'AP', url: 'https://apnews.com/a' },
    { ...base, id: 'two', sourceName: 'Associated Press', url: 'https://apnews.com/b' },
    { ...base, id: 'three', sourceName: 'AP', url: 'https://apnews.com/c' }
  ]);
  assert.equal(sameAgency.promoted.length, 0);
});

test('a widely covered Australian attack stays under Australia', () => {
  const base = { publishedAt: '2026-11-16T09:00:00Z', title: 'Australian MP Helen Haines leaves hospital after losing both legs in alleged car attack', sectionId: 'Miscellaneous', subsection: 'SOUTH PACIFIC', country: 'Australia' };
  const result = selectWeekendStories([
    { ...base, id: 'one', sourceName: 'Reuters', url: 'https://reuters.com/a' },
    { ...base, id: 'two', sourceName: 'AP', url: 'https://apnews.com/a' },
    { ...base, id: 'three', sourceName: 'AFP', url: 'https://afp.com/a' }
  ]);
  assert.equal(result.articles.length, 1);
  assert.equal(result.articles[0].sectionId, 'Miscellaneous');
  assert.equal(result.articles[0].country, 'Australia');
  assert.equal(result.promoted.length, 0);
});

test('automatic editions place two distinct Ukraine war developments in leads', () => {
  const base = { sectionId: 'Eastern Europe', section: 'Eastern Europe', subsection: 'Ukraine', country: '', publishedAt: '2026-11-19T09:00:00Z' };
  const stories = [
    { ...base, id: 'diplomacy', title: 'Russia agrees security guarantees for Ukraine after peace talks', sourceName: 'Reuters', url: 'https://reuters.com/ukraine-talks' },
    { ...base, id: 'attack', title: 'Russian missile strikes hit Kyiv overnight', sourceName: 'BBC', url: 'https://bbc.com/kyiv-strikes' },
    { ...base, id: 'local', title: 'Ukraine deploys new drones on frontline', sourceName: 'Ukrinform', url: 'https://ukrinform.net/drones' },
    { ...base, id: 'domestic', title: 'Ukraine parliament approves new budget', sourceName: 'AP', url: 'https://apnews.com/budget' }
  ];
  const result = ensureUkraineWarLeads(stories);
  assert.deepEqual(result.articles.filter(article => article.sectionId === 'Lead stories').map(article => article.id), ['diplomacy', 'attack']);
  assert.deepEqual(result.leadOrigins.attack, { sectionId: 'Eastern Europe', subsection: 'Ukraine', country: '' });
  assert.equal(result.articles.find(article => article.id === 'local').sectionId, 'Eastern Europe');
  assert.equal(result.articles.find(article => article.id === 'domestic').sectionId, 'Eastern Europe');
  assert.equal(ensureUkraineWarLeads(result.articles, result.leadOrigins).promoted.length, 0);
});

test('Ukraine lead promotion does not invent a second lead or promote repeated coverage', () => {
  const base = { sectionId: 'Eastern Europe', section: 'Eastern Europe', subsection: 'Ukraine', country: '', publishedAt: '2026-11-19T09:00:00Z' };
  const result = ensureUkraineWarLeads([
    { ...base, id: 'first', title: 'Russian missile strikes hit Kyiv overnight', sourceName: 'Reuters', url: 'https://reuters.com/a' },
    { ...base, id: 'duplicate', title: 'Russian missile strikes hit Kyiv overnight', sourceName: 'AP', url: 'https://apnews.com/a' }
  ]);
  assert.equal(result.promoted.length, 1);
});

test('lead promotion cleans a publisher teaser already present in a completed draft', () => {
  const result = ensureUkraineWarLeads([{
    id: 'feed-fragment', sectionId: 'Eastern Europe', section: 'Eastern Europe', subsection: 'Ukraine', country: '',
    title: 'UK to provide Ukraine with 1,000 long-range strike drones The prime minister made the announcement in Berlin. 2 hrs ago UK',
    sourceName: 'BBC', url: 'https://bbc.com/fragment'
  }]);
  assert.equal(result.articles[0].sectionId, 'Lead stories');
  assert.equal(result.articles[0].title, 'UK to provide Ukraine with 1,000 long-range strike drones');
});

test('Vienna schedule handles summer and winter UTC offsets', () => {
  assert.deepEqual(viennaSchedule(new Date('2026-07-04T05:00:00Z')), { date: '2026-07-04', hour: 7, minute: 0, weekend: true });
  assert.deepEqual(viennaSchedule(new Date('2026-11-07T06:00:00Z')), { date: '2026-11-07', hour: 7, minute: 0, weekend: true });
});

test('a current dated tab can be checked when NewsStatus is unavailable', () => {
  const sheet = { date: '2026-11-08', sheetName: '2026-11-08', rows: [{ url: 'https://example.com/a' }] };
  assert.equal(weekendSheetReadiness(sheet, '2026-11-08'), 'verify-stable');
  assert.equal(weekendSheetReadiness({ ...sheet, runStatus: 'COMPLETE', statusDate: '2026-11-08' }, '2026-11-08'), 'complete');
  assert.equal(weekendSheetReadiness({ ...sheet, runStatus: 'RUNNING', statusDate: '2026-11-08' }, '2026-11-08'), 'in-progress');
  assert.equal(weekendSheetReadiness(sheet, '2026-11-07'), 'missing');
});
