import test from 'node:test';
import assert from 'node:assert/strict';
import { sameNewsEvent, possibleDuplicates } from '../src/storyDuplicates.js';

const story = (id, title, summary = '') => ({ id, title, summary, publishedAt: '2026-10-14T12:00:00Z', sourceName: id });

test('flags the same visit across agencies with different wording', () => {
  const a = story('AsiaOne', 'US top diplomat Marco Rubio to visit India and Uzbekistan');
  const b = story('Pajhwok', 'Rubio to travel to India, Uzbekistan');
  assert.equal(sameNewsEvent(a, b), true);
  assert.equal(possibleDuplicates([a, b]).get('AsiaOne')?.[0].id, 'Pajhwok');
});

test('does not flag distinct actions involving the same country', () => {
  const a = story('a', 'Ukraine and Poland sign new security deal');
  const b = story('b', 'Ukraine and Poland discuss border restrictions');
  assert.equal(sameNewsEvent(a, b), false);
});

test('does not flag similar headlines published days apart', () => {
  const a = story('a', 'Rubio to visit India and Uzbekistan');
  const b = { ...story('b', 'Rubio will travel to India and Uzbekistan'), publishedAt: '2026-10-18T12:00:00Z' };
  assert.equal(sameNewsEvent(a, b), false);
});
