import test from 'node:test';
import assert from 'node:assert/strict';
import sources from '../sources.json' with { type: 'json' };
import { displaySourceName } from './sourceNames.js';
import { defaultSiteConfig, displaySiteContent, displaySources } from './siteConfig.js';
import { spreadsheetRow } from './spreadsheetExport.js';

test('all Local editions use their website suffix in source lists and old stories', () => {
  const editions = [
    ['Sweden', 'se'], ['France', 'fr'], ['Germany', 'de'],
    ['Spain', 'es'], ['Switzerland', 'ch'], ['Austria', 'at']
  ];
  for (const [country, suffix] of editions) {
    const old = `Local ${country}`;
    const expected = `Local.${suffix}`;
    assert.equal(displaySourceName(old), expected);
    const source = sources.find(item => item.url === `https://www.thelocal.${suffix}/`);
    assert.equal(source.name, expected);
    const article = { id: suffix, section: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country, title: 'Talks continue', sourceName: old, url: `${source.url}story` };
    const config = defaultSiteConfig([article]);
    config.articleEdits[suffix] = { sourceName: old };
    assert.equal(displaySiteContent([article], config)[0].sourceName, expected);
    assert.equal(displaySources([{ ...source, name: old }], config)[0].name, expected);
    assert.equal(spreadsheetRow(article, { heading: article.title, body: 'Officials held talks.' })[1], expected);
  }
  assert.equal(displaySourceName('Local news'), 'Local news');
});
