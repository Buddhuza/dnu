import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSiteConfig, normalizeSiteConfig, displaySiteContent } from './siteConfig.js';

const articles = [
  { id: 'a', section: 'Europe', subsection: 'Poland', title: 'Original headline', summary: 'Original summary.', sourceName: 'Agency', url: 'https://example.com/a' },
  { id: 'b', section: 'Asia', subsection: 'Japan', title: 'Second headline', summary: 'Second summary.', sourceName: 'Agency', url: 'https://example.com/b' }
];

test('section edits reorder, rename, and hide news without changing source data', () => {
  const config = defaultSiteConfig(articles);
  config.sections = [{ id: 'Asia', name: 'Asia Pacific', visible: true }, { id: 'Europe', name: 'Europe', visible: false }];
  config.articleEdits.b = { title: 'Edited headline', summary: 'New detail.', sectionId: 'Asia', subsection: 'Japan', hidden: false };
  const displayed = displaySiteContent(articles, config);
  assert.deepEqual(displayed.map(item => item.title), ['Edited headline']);
  assert.equal(displayed[0].section, 'Asia Pacific');
  assert.equal(articles[1].title, 'Second headline');
});

test('import rejects unsafe links and invalid colors', () => {
  const config = normalizeSiteConfig({
    version: 1,
    theme: { primary: 'red; background: black' },
    customArticles: [{ title: 'Unsafe', url: 'javascript:alert(1)' }]
  }, articles);
  assert.equal(config.theme.primary, '#123e47');
  assert.equal(config.customArticles.length, 0);
  assert.equal(config.sections.length, 2);
});
