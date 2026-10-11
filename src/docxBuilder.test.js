import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { createReportDocxFromTemplate } from './docxBuilder.js';

test('browser report download creates a readable Word file with country headings', async () => {
  const template = readFileSync(new URL('../public/daily-update-template.docx', import.meta.url));
  const output = await createReportDocxFromTemplate(template, {
    title: 'DAILY NEWS UPDATE',
    articles: [{ section: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'Belgium', title: 'Exact headline', summary: 'A factual second sentence.', sourceName: 'Agency', url: 'https://example.com/story' }]
  });
  assert.ok(output instanceof Uint8Array);
  const zip = await JSZip.loadAsync(output);
  const document = await zip.file('word/document.xml').async('string');
  assert.match(document, /BELGIUM/);
  assert.match(document, /Exact headline/);
  assert.match(await zip.file('word/_rels/document.xml.rels').async('string'), /https:\/\/example.com\/story/);
});
