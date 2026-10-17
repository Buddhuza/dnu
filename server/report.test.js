import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { createReportDocx } from './report.js';

test('Word report preserves article text, sections, and linked agency names', async () => {
  const buffer = await createReportDocx({
    title: 'DAILY NEWS UPDATE',
    articles: [{ section: 'Eastern Europe', subsection: 'Ukraine', title: 'Exact headline', summary: 'A verified extra fact.', sourceName: 'Test News', url: 'https://example.com/story' }],
    sourceOutcomes: [
      { name: 'Missing News', status: 'source page could not be fetched' },
      { name: 'Unselected News', status: 'no matching headline in this scrape' }
    ]
  });
  const zip = await JSZip.loadAsync(buffer);
  const document = await zip.file('word/document.xml').async('string');
  const relationships = await zip.file('word/_rels/document.xml.rels').async('string');
  assert.match(document, /Exact headline/);
  assert.match(document, /A verified extra fact/);
  assert.match(document, /Exact headline\./);
  assert.match(document, /A verified extra fact\./);
  assert.match(document, /EASTERN EUROPE/);
  assert.doesNotMatch(document, /Missing News|Unselected News|AGENCIES FROM WHICH NO QUALIFYING ARTICLE WAS COLLECTED/);
  assert.match(document, /w:fill="D9E2F3"/);
  assert.match(document, /w:val="0070C0"/);
  assert.match(document, /Organisation for Security and Co-operation in Europe/);
  assert.doesNotMatch(document, /Organization for Security and Co-operation in Europe/);
  assert.ok(zip.file('word/media/image1.png'));
  assert.ok(zip.file('word/footer1.xml'));
  assert.match(document, /<w:t xml:space="preserve">Test News<\/w:t>/);
  assert.match(relationships, /https:\/\/example\.com\/story/);
});
