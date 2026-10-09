import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { createReportDocx } from './report.js';

test('Word report preserves article text, sections, and linked agency names', async () => {
  const buffer = await createReportDocx({
    title: 'DAILY NEWS UPDATE',
    articles: [{ section: 'Eastern Europe', subsection: 'Ukraine', title: 'Exact headline', summary: 'A verified extra fact.', sourceName: 'Test News', url: 'https://example.com/story' }],
    sourceOutcomes: [{ name: 'Missing News', status: 'source page could not be fetched' }]
  });
  const zip = await JSZip.loadAsync(buffer);
  const document = await zip.file('word/document.xml').async('string');
  const relationships = await zip.file('word/_rels/document.xml.rels').async('string');
  assert.match(document, /Exact headline/);
  assert.match(document, /A verified extra fact/);
  assert.match(document, /EASTERN EUROPE/);
  assert.match(document, /Missing News/);
  assert.match(document, /\(Test News\)/);
  assert.match(relationships, /https:\/\/example\.com\/story/);
});
