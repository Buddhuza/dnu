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

test('sheet agency aliases and legacy source names use DNU labels', () => {
  const pairs = [
    ['DTT NET', 'DTT'], ['Albanian Daily News', 'ADN'], ['N1 Bosnia', 'N1'], ['N1 Serbia', 'N1'],
    ['GreekReporter.com', 'Greek Reporter'], ['Mezha.net', 'Mezha'], ['RFE RL', 'RFE/RL'],
    ['1TV Georgia', '1TV.ge'], ['1TV', '1TV.ge'], ['Asia Plus', 'Asia-Plus'],
    ['Crude Oil Prices Today | OilPrice.com', 'OilPrice.com'], ['IPN Moldova', 'IPN.md'],
    ['ipn.md', 'IPN.md'], ['interpressnews.ge', 'IPN.ge'], ['Qazinform', 'Kazinform'],
    ['Politico Europe', 'Politico.eu']
  ];
  for (const [input, expected] of pairs) assert.equal(displaySourceName(input), expected, input);
  assert.equal(displaySourceName('IPN', { sourceId: 'source-32' }), 'IPN.md');
  assert.equal(displaySourceName('IPN', { url: 'https://www.interpressnews.ge/en/story' }), 'IPN.ge');
  assert.equal(displaySourceName('IPN', { url: 'https://ipn.md/en/story' }), 'IPN.md');
  assert.equal(displaySourceName('IPN'), 'IPN');
  assert.equal(displaySources(sources, defaultSiteConfig([])).find(source => source.id === 'source-62').name, '1TV.ge');
});
