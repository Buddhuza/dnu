import test from 'node:test';
import assert from 'node:assert/strict';
import { sameNewsEvent, possibleDuplicates, duplicateGroups, duplicateGroupHue } from '../src/storyDuplicates.js';

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

test('separate duplicate groups have distinct colors and labels', () => {
  const articles = [
    story('a', 'Rubio to visit India and Uzbekistan'),
    story('b', 'Rubio will travel to India and Uzbekistan'),
    story('c', 'Ukrainian drones slowed by Starlink restrictions'),
    story('d', 'Starlink restrictions slow Ukrainian drones')
  ];
  const groups = duplicateGroups(articles);
  assert.equal(groups.get('a').number, groups.get('b').number);
  assert.equal(groups.get('c').number, groups.get('d').number);
  assert.notEqual(groups.get('a').number, groups.get('c').number);
  assert.notEqual(duplicateGroupHue(groups.get('a').number), duplicateGroupHue(groups.get('c').number));
});

test('an unchecked duplicate clears the flag on its remaining story', () => {
  const a = story('a', 'Rubio to visit India and Uzbekistan');
  const b = story('b', 'Rubio will travel to India and Uzbekistan');
  assert.equal(duplicateGroups([a, b]).has('a'), true);
  assert.equal(duplicateGroups([a]).has('a'), false);
  assert.equal(duplicateGroups([b]).has('b'), false);
});
