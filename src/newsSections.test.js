import test from 'node:test';
import assert from 'node:assert/strict';
import { NEWS_SECTIONS, MISCELLANEOUS_COUNTRIES, orderedSubsections, compareCountryLabels } from './newsSections.js';

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

test('lead headings put Ukraine first only when Ukraine and Middle East are the sole headings', () => {
  const section = NEWS_SECTIONS[0];
  assert.deepEqual(orderedSubsections(section, ['Middle East', 'Ukraine']), ['Ukraine', 'Middle East']);
  assert.deepEqual(orderedSubsections(section, ['Ukraine', 'Albania', 'Middle East']), ['Albania', 'Middle East', 'Ukraine']);
});

test('international organisations follow editorial priority rather than the alphabet', () => {
  const shuffled = ['CSTO', 'WTO', 'BRICS', 'UN', 'G7', 'CIS', 'NATO', 'EU', 'IMF', 'OSCE', 'ICC', 'G20'];
  assert.deepEqual(shuffled.sort((a, b) => compareCountryLabels('INTERNATIONAL ORGANISATIONS', a, b)), MISCELLANEOUS_COUNTRIES['INTERNATIONAL ORGANISATIONS']);
  assert.deepEqual(['SCO', 'OECD', 'BRICS', 'World Bank'].sort((a, b) => compareCountryLabels('INTERNATIONAL ORGANISATIONS', a, b)), ['OECD', 'World Bank', 'BRICS', 'SCO']);
  assert.deepEqual(['United Kingdom', 'Italy'].sort((a, b) => compareCountryLabels('WESTERN / CENTRAL EUROPE', a, b)), ['Italy', 'United Kingdom']);
});
