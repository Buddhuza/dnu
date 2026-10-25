import test from 'node:test';
import assert from 'node:assert/strict';
import { balanceAgencyShare, limitStoriesPerHeading, selectDiverseLeadStories, storyHeadingKey } from './storySelection.js';

const story = (id, section, subsection, country = '') => ({ id, section, subsection, country, sourceName: 'Agency', title: `Security talks ${id}`, summary: 'Officials discussed security cooperation.', publishedAt: '2026-10-18T12:00:00Z' });

test('country limit excludes lead stories and retains the most consequential regional coverage', () => {
  const leads = Array.from({ length: 4 }, (_, index) => story(`lead-${index}`, 'Lead stories', 'Ukraine'));
  const regional = Array.from({ length: 12 }, (_, index) => story(`local-${index}`, 'Eastern Europe', 'Ukraine'));
  regional[0].title = 'Ukraine signs peace agreement with neighbours';
  regional[0].sourceName = 'Reuters';
  const result = limitStoriesPerHeading([...regional, ...leads], { windowStart: '2026-10-16T10:00:00Z', windowEnd: '2026-10-18T20:00:00Z' });
  assert.equal(result.kept.length, 14);
  assert.ok(leads.every(lead => result.kept.includes(lead)));
  assert.ok(result.kept.includes(regional[0]));
  assert.equal(result.removed.length, 2);
  assert.equal(storyHeadingKey(leads[0]), '');
});

test('miscellaneous countries and organisations use their own ten-story groups', () => {
  const russian = Array.from({ length: 12 }, (_, index) => story(`ru-${index}`, 'Miscellaneous', 'RUSSIA / EURASIA', 'Russia'));
  const european = Array.from({ length: 12 }, (_, index) => story(`eu-${index}`, 'Miscellaneous', 'INTERNATIONAL ORGANISATIONS', 'EU'));
  const result = limitStoriesPerHeading([...russian, ...european]);
  assert.equal(result.kept.filter(item => item.country === 'Russia').length, 10);
  assert.equal(result.kept.filter(item => item.country === 'EU').length, 10);
  assert.equal(storyHeadingKey(story('me', 'Lead stories', 'Middle East')), '');
});

test('equivalent verified reports can bring an agency down to half a country group', () => {
  const selected = [1, 2, 3, 4].map(id => ({ ...story(`${id}`, 'South Eastern Europe', 'Albania'), sourceName: id === 4 ? 'Agency B' : 'Agency A', eventId: id, url: `https://example.com/${id}` }));
  const alternative = { ...selected[0], id: 'alternative', url: 'https://other.example/1', sourceName: 'Agency B' };
  const result = balanceAgencyShare(selected, [alternative], { sameEvent: (a, b) => a.eventId === b.eventId });
  assert.equal(result.replacements.length, 1);
  assert.equal(result.articles.filter(article => article.sourceName === 'Agency A').length, 2);
  assert.equal(result.articles.filter(article => article.sourceName === 'Agency B').length, 2);
});

test('agency balance keeps distinct news when no comparable alternative exists', () => {
  const selected = [1, 2].map(id => ({ ...story(`${id}`, 'South Eastern Europe', 'Albania'), sourceName: 'Agency A', eventId: id, url: `https://example.com/${id}` }));
  const unrelated = { ...selected[0], id: 'unrelated', eventId: 3, url: 'https://other.example/3', sourceName: 'Agency B' };
  const weak = { ...selected[0], id: 'weak', url: 'https://other.example/1', sourceName: 'Agency B', title: 'Possible plan could emerge' };
  const result = balanceAgencyShare(selected, [unrelated, weak], { sameEvent: (a, b) => a.eventId === b.eventId, qualityTolerance: 0 });
  assert.deepEqual(result.articles, selected);
  assert.equal(result.replacements.length, 0);
});

test('ten-story country limit uses roughly half from each agency when comparable reports exist', () => {
  const stories = [...Array.from({ length: 6 }, (_, index) => ({ ...story(`reuters-${index}`, 'Eastern Europe', 'Ukraine'), sourceName: 'Reuters' })),
    ...Array.from({ length: 6 }, (_, index) => ({ ...story(`ap-${index}`, 'Eastern Europe', 'Ukraine'), sourceName: 'AP' }))];
  const result = limitStoriesPerHeading(stories, { limit: 10 });
  assert.equal(result.kept.filter(item => item.sourceName === 'Reuters').length, 5);
  assert.equal(result.kept.filter(item => item.sourceName === 'AP').length, 5);
});

test('lead selection uses another agency when its story is comparably important', () => {
  const candidates = [
    { id: 'first', sourceName: 'Reuters', score: 100 },
    { id: 'second', sourceName: 'Reuters', score: 95 },
    { id: 'alternative', sourceName: 'AP', score: 90 }
  ];
  assert.deepEqual(selectDiverseLeadStories(candidates, 2, item => item.score).map(item => item.id), ['first', 'alternative']);
  assert.deepEqual(selectDiverseLeadStories(candidates, 2, item => item.score, 3).map(item => item.id), ['first', 'alternative']);
});
