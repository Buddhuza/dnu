import test from 'node:test';
import assert from 'node:assert/strict';
import { limitStoriesPerHeading, storyHeadingKey } from './storySelection.js';

const story = (id, section, subsection, country = '') => ({ id, section, subsection, country, sourceName: 'Agency', title: `Security talks ${id}`, summary: 'Officials discussed security cooperation.', publishedAt: '2026-10-18T12:00:00Z' });

test('country limit includes its lead stories and retains the most consequential coverage', () => {
  const lead = story('lead', 'Lead stories', 'Ukraine');
  const regional = Array.from({ length: 10 }, (_, index) => story(`local-${index}`, 'Eastern Europe', 'Ukraine'));
  regional[0].title = 'Ukraine signs peace agreement with neighbours';
  regional[0].sourceName = 'Reuters';
  const result = limitStoriesPerHeading([...regional, lead], { windowStart: '2026-10-16T10:00:00Z', windowEnd: '2026-10-18T20:00:00Z' });
  assert.equal(result.kept.length, 10);
  assert.ok(result.kept.includes(lead));
  assert.ok(result.kept.includes(regional[0]));
  assert.equal(result.removed.length, 1);
});

test('miscellaneous countries and organisations use their own ten-story groups', () => {
  const russian = Array.from({ length: 12 }, (_, index) => story(`ru-${index}`, 'Miscellaneous', 'RUSSIA / EURASIA', 'Russia'));
  const european = Array.from({ length: 12 }, (_, index) => story(`eu-${index}`, 'Miscellaneous', 'INTERNATIONAL ORGANISATIONS', 'EU'));
  const result = limitStoriesPerHeading([...russian, ...european]);
  assert.equal(result.kept.filter(item => item.country === 'Russia').length, 10);
  assert.equal(result.kept.filter(item => item.country === 'EU').length, 10);
  assert.equal(storyHeadingKey(story('me', 'Lead stories', 'Middle East')), '');
});
