import test from 'node:test';
import assert from 'node:assert/strict';
import { convertSpreadsheetRows } from './spreadsheetImport.js';
import { weekendPlacementForRow, resolveWeekendPlacementRows } from './weekendPlacement.js';

test('weekend placement uses headline city, nationality and country clues', () => {
  assert.deepEqual(weekendPlacementForRow({ heading: 'Gunman kills six in Krakow', region: 'International' }),
    { sectionId: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'Poland' });
  assert.deepEqual(weekendPlacementForRow({ heading: 'Yemeni forces report advances in Taiz', region: 'International' }),
    { sectionId: 'Miscellaneous', subsection: 'MIDDLE EAST / NORTH AFRICA', country: 'Yemen' });
  assert.deepEqual(weekendPlacementForRow({ heading: 'Greek cargo ship sinks off Bulgaria', region: 'Europe' }),
    { sectionId: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'Bulgaria' });
  assert.deepEqual(weekendPlacementForRow({ heading: 'Russia hits Kyiv with airstrikes', region: 'International' }),
    { sectionId: 'Eastern Europe', subsection: 'Ukraine', country: '' });
});

test('weekend placement uses the regional source home for cross-border headlines', () => {
  assert.deepEqual(weekendPlacementForRow({ heading: 'Armenian minister discusses Kosovo with officials', region: 'South Caucasus', url: 'https://pan.am/en/news/example' }),
    { sectionId: 'South Caucasus', subsection: 'Armenia', country: '' });
});

test('weekend placement can use the organisation or broad region when no country is named', () => {
  assert.deepEqual(weekendPlacementForRow({ heading: 'OSCE opens security talks in Vienna', region: 'International' }),
    { sectionId: 'Miscellaneous', subsection: 'INTERNATIONAL ORGANISATIONS', country: 'OSCE' });
  assert.deepEqual(weekendPlacementForRow({ heading: 'Officials discuss cross-border energy links', region: 'Europe' }),
    { sectionId: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: '' });
  assert.deepEqual(weekendPlacementForRow({ heading: 'Officials discuss cross-border energy links', region: 'International' }),
    { sectionId: 'Miscellaneous', subsection: '', country: '' });
});

test('weekend conversion publishes rows that manual import would hold for placement', () => {
  const rows = [
    { rowNumber: 2, date: '2026-11-08', source: 'AP', region: 'International', url: 'https://apnews.com/article/krakow-test', heading: 'Gunman kills six in Krakow' },
    { rowNumber: 3, date: '2026-11-08', source: 'AP', region: 'International', url: 'https://apnews.com/article/yemen-test', heading: 'Five killed in Houthi attack in Taiz' },
    { rowNumber: 4, date: '2026-11-08', source: 'AP', region: 'Europe', url: 'https://apnews.com/article/europe-test', heading: 'Officials discuss cross-border energy links' }
  ];
  const initial = convertSpreadsheetRows(rows);
  assert.equal(initial.needsPlacement.length, 3);
  const result = resolveWeekendPlacementRows(rows, convertSpreadsheetRows);
  assert.equal(result.needsPlacement.length, 0);
  assert.equal(result.autoPlaced.length, 3);
  assert.equal(result.articles.length, 3);
  assert.ok(result.articles.every(article => article.weekendAutoPlaced));
  assert.deepEqual(result.articles.map(article => [article.subsection, article.country]), [
    ['WESTERN / CENTRAL EUROPE', 'Poland'], ['MIDDLE EAST / NORTH AFRICA', 'Yemen'], ['WESTERN / CENTRAL EUROPE', '']
  ]);
});
