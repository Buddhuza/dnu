import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyEdition } from './emptyEdition.js';
import { defaultSiteConfig, displaySiteContent } from './siteConfig.js';

test('clearing the update hides all stories while its section structure remains available', () => {
  const article = { id: 'one', section: 'Eastern Europe', sectionId: 'Eastern Europe', subsection: 'Ukraine', title: 'News' };
  const original = { title: 'DAILY NEWS UPDATE', articles: [article], importedFromSpreadsheet: true, importedFileName: 'sheet.xlsx' };
  const config = defaultSiteConfig(original.articles);
  const cleared = emptyEdition(original, '2026-10-31T12:00:00.000Z');
  assert.equal(cleared.articles.length, 0);
  assert.equal(cleared.emptyPrepared, true);
  assert.equal(cleared.importedFromSpreadsheet, false);
  assert.equal(original.articles.length, 1);
  assert.ok(config.sections.some(section => section.id === 'Eastern Europe' && section.subsections.includes('Ukraine')));
  assert.deepEqual(displaySiteContent(cleared.articles, config), []);
});
