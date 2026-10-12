import test from 'node:test';
import assert from 'node:assert/strict';
import { NEWS_SECTIONS, orderedSubsections } from './newsSections.js';

test('news section taxonomy places organisations under Miscellaneous', () => {
  assert.deepEqual(NEWS_SECTIONS.map(section => section.id), [
    'Lead stories', 'South Eastern Europe', 'Eastern Europe', 'South Caucasus', 'Central Asia', 'Miscellaneous'
  ]);
  assert.deepEqual(NEWS_SECTIONS[0].subsections, ['Ukraine', 'Middle East']);
  assert.ok(NEWS_SECTIONS.at(-1).subsections.includes('INTERNATIONAL ORGANISATIONS'));
  assert.ok(NEWS_SECTIONS[1].subsections.includes('Serbia / Kosovo'));
  assert.ok(NEWS_SECTIONS[2].subsections.includes('Moldova / Transdniestria'));
  assert.ok(NEWS_SECTIONS[3].subsections.includes('Georgia / Abkhazia / South Ossetia'));
});

test('subsections follow the configured order', () => {
  const section = NEWS_SECTIONS[1];
  assert.deepEqual(orderedSubsections(section, ['Serbia / Kosovo', 'Albania', 'Serbia']), ['Albania', 'Serbia', 'Serbia / Kosovo']);
});
