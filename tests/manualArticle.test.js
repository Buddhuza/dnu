import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareManualArticle } from '../src/manualArticle.js';
import { addCustomArticleInConfig, defaultSiteConfig, displaySiteContent, normalizeSiteConfig } from '../src/siteConfig.js';

test('manual Add keeps an editorial override and a second story at the same link after reload', () => {
  const base = { url: 'https://example.com/opinion', sourceId: 'manual', sourceName: 'Government', title: 'Opinion: Why is this happening?', summary: 'The government says it has a plan', publishedAt: '2026-11-08T08:00:00Z', sectionId: 'South Eastern Europe', subsection: 'Albania', manualOverride: true };
  const first = addCustomArticleInConfig(defaultSiteConfig(), { ...base, id: 'one' });
  const second = addCustomArticleInConfig(first, { ...base, id: 'two' });
  const restored = normalizeSiteConfig(JSON.parse(JSON.stringify(second)));
  assert.equal(displaySiteContent([], restored).length, 2);
  assert.equal(restored.customArticles[0].manualOverride, true);
});

test('manual Add summarises the first paragraph but preserves the complete English text', async () => {
  const text = 'The ministers signed a new security agreement in Vienna on Sunday. The pact will enter into force next year.\n\nThe second paragraph contains background and further details.';
  const result = await prepareManualArticle('Ministers meet in Vienna', text, 'en');
  assert.equal(result.body, text);
  assert.ok(result.summary.includes('security agreement'));
  assert.ok(!result.summary.includes('second paragraph'));
  assert.equal(result.translated, false);
});

test('manual Add translates the headline and complete text before summarising', async () => {
  const prior = globalThis.Translator;
  globalThis.Translator = { create: async () => ({ translate: async value => value.startsWith('Заголовок') ? 'Ministers sign agreement' : value.replace('Первый абзац.', 'The ministers agreed on a security pact in Vienna.').replace('Второй абзац.', 'Officials will meet again next month.'), destroy() {} }) };
  try {
    const result = await prepareManualArticle('Заголовок', 'Первый абзац.\n\nВторой абзац.', 'ru');
    assert.equal(result.title, '(文A) Ministers sign agreement');
    assert.equal(result.originalHeadline, 'Заголовок');
    assert.ok(result.body.includes('Officials will meet again'));
    assert.ok(result.summary.includes('security pact'));
    assert.ok(!result.summary.includes('Officials will meet again'));
    assert.equal(result.translated, true);
  } finally { globalThis.Translator = prior; }
});
