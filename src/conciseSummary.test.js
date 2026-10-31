import test from 'node:test';
import assert from 'node:assert/strict';
import { conciseDnuSummary } from './conciseSummary.js';
import { displaySiteContent, normalizeSiteConfig } from './siteConfig.js';

test('long imported feed copy becomes one short sentence', () => {
  const summary = "Wednesday's deadly train crash has dealt a serious blow to Spanish Prime Minister Pedro Sanchez’s campaign. The accident in Toledo province killed 69 people and came just nine months after another deadly crash on the same line, leading to accusations from experts and the public of underinvestment in railway infrastructure under Sanchez's government after years of rapid network expansion.";
  assert.equal(conciseDnuSummary(summary, 'Spain reckons with second deadly train crash ahead of national election'), "Wednesday's deadly train crash has dealt a serious blow to Spanish Prime Minister Pedro Sanchez’s campaign");
});

test('an existing imported update displays concise copy while retaining an editor rewrite', () => {
  const article = { id: 'import-1', fromSpreadsheet: true, sectionId: 'Miscellaneous', section: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'Spain', sourceName: 'Reuters', url: 'https://example.com/spain', title: 'Spain faces another train crash before election', summary: 'Spanish officials described a deadly crash. The accident in Toledo province killed 69 people and came nine months after another crash on the same line, prompting accusations of underinvestment in railway infrastructure.' };
  const config = normalizeSiteConfig({}, [article]);
  assert.match(displaySiteContent([article], config)[0].summary, /accident in Toledo province killed 69 people/);
  assert.ok(displaySiteContent([article], config)[0].summary.split(/\s+/).length <= 30);
  const edited = normalizeSiteConfig({ ...config, articleEdits: { [article.id]: { summary: 'The crash killed 69 people in Toledo province.', summaryEdited: true } } }, [article]);
  assert.equal(displaySiteContent([article], edited)[0].summary, 'The crash killed 69 people in Toledo province.');
});
