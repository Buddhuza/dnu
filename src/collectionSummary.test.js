import test from 'node:test';
import assert from 'node:assert/strict';
import { countCoveredCountries } from './collectionSummary.js';

test('collection summary counts visible country headings once and excludes organisations and topics', () => {
  const articles = [
    { sectionId: 'Lead stories', subsection: 'Ukraine' },
    { sectionId: 'Eastern Europe', subsection: 'Ukraine' },
    { sectionId: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'France' },
    { sectionId: 'Miscellaneous', subsection: 'INTERNATIONAL ORGANISATIONS', country: 'OSCE' },
    { sectionId: 'Lead stories', subsection: 'Middle East' },
    { sectionId: 'South Eastern Europe', subsection: '' }
  ];
  assert.equal(countCoveredCountries(articles), 2);
});
