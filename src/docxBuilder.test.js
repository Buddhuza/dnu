import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { createReportDocxFromTemplate } from './docxBuilder.js';
import { reportFilename } from './reportFilename.js';

test('browser report download creates a readable Word file with country headings', async () => {
  const template = readFileSync(new URL('../public/daily-update-template.docx', import.meta.url));
  const output = await createReportDocxFromTemplate(template, {
    title: 'DAILY NEWS UPDATE', windowStart: '2026-10-04T22:00:00Z', windowEnd: '2026-10-09T21:59:59Z', coverageNote: 'This coverage note must not appear.',
    sourceOutcomes: [{ name: 'Uncollected agency', status: 'source page could not be fetched' }],
    articles: [
      { section: 'Lead stories', subsection: 'Middle East', title: 'Lead headline', summary: 'A factual lead sentence.', sourceName: 'Agency', url: 'https://example.com/lead' },
      { section: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'Belgium', title: 'Exact headline', summary: 'A factual second sentence.', sourceName: 'Agency', url: 'https://example.com/story' }
    ]
  });
  assert.ok(output instanceof Uint8Array);
  const zip = await JSZip.loadAsync(output);
  const document = await zip.file('word/document.xml').async('string');
  assert.match(document, /BELGIUM/);
  assert.match(document.split('MIDDLE EAST')[0].split('<w:p>').at(-1), /<w:shd[^>]*w:fill="D9E2F3"/);
  assert.match(document, /5–9 October 2026/);
  assert.ok(document.indexOf('DAILY NEWS UPDATE') < document.indexOf('5–9 October 2026'));
  assert.doesNotMatch(document.split('WESTERN / CENTRAL EUROPE')[0].split('<w:p>').at(-1), /<w:shd/);
  assert.match(document.split('BELGIUM')[0].split('<w:p>').at(-1), /<w:shd[^>]*w:fill="D9E2F3"/);
  assert.match(document, /Exact headline/);
  assert.match(document, /A factual second sentence/);
  assert.match(document, /Exact headline\.[\s\S]*?A factual second sentence\.[\s\S]*?Agency/);
  assert.doesNotMatch(document, /Exact headline\.[\s\S]*?<w:br\/>[\s\S]*?A factual second sentence/);
  assert.doesNotMatch(document, /COVERAGE NOTE|This coverage note must not appear/);
  assert.doesNotMatch(document, /Uncollected agency/);
  assert.match(document, /<w:tblpPr[^>]*w:tblpYSpec="bottom"/);
  assert.match(document, /<w:tblBorders><w:top w:val="single"/);
  assert.match(document, /Disclaimer:/);
  assert.match(document, /This product is based on open media sources only/);
  assert.match(document, /We would like to remind all our recipients/);
  assert.ok(document.indexOf('Disclaimer:') > document.indexOf('Exact headline'));
  assert.match(await zip.file('word/_rels/document.xml.rels').async('string'), /https:\/\/example.com\/story/);
});

test('download filename uses coverage dates and Vienna times', () => {
  assert.equal(reportFilename({ windowStart: '2026-10-04T22:00:00Z', windowEnd: '2026-10-09T21:59:59Z' }), 'Daily news update - 2026-10-05 00-00 to 2026-10-09 23-59.docx');
});
