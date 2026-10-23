import test from 'node:test';
import assert from 'node:assert/strict';
import { reportHeadingLabel } from './reportLabels.js';
import { spreadsheetRow } from './spreadsheetExport.js';

test('country and organisation titles use US, UK and UN without changing other headings', () => {
  assert.equal(reportHeadingLabel('United States'), 'US');
  assert.equal(reportHeadingLabel('United Kingdom'), 'UK');
  assert.equal(reportHeadingLabel('United Nations'), 'UN');
  assert.equal(reportHeadingLabel('South Eastern Europe'), 'South Eastern Europe');
});

test('spreadsheet countries and organisations use shortened titles without duplicates', () => {
  const page = { heading: 'US and UK meet at UN', body: 'The United States and United Kingdom held talks at the United Nations.' };
  const article = { id: 'one', sourceName: 'AP', section: 'Miscellaneous', subsection: 'NORTH AMERICA', country: 'United States', title: page.heading, url: 'https://example.com/story' };
  const row = spreadsheetRow(article, page);
  assert.equal(row[3], 'US, UK');
  assert.equal(row[5], 'UN');
  assert.equal(spreadsheetRow({ ...article, subsection: 'INTERNATIONAL ORGANISATIONS', country: 'United Nations' }, page)[5], 'UN');
});
