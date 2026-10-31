import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFullArticle } from './articleBodyClient.js';

test('published body cache supplies an article without another Firecrawl request', async () => {
  const url = 'https://example.com/article';
  const requests = [];
  const result = await loadFullArticle({ url, title: 'Example headline' }, { fetchImpl: async target => {
    requests.push(target);
    assert.match(target, /article-bodies\.json$/);
    return { ok: true, async json() { return { articles: { [url]: { heading: 'Original headline', body: 'The complete article body.' } } }; } };
  } });
  assert.deepEqual(result, { heading: 'Original headline', body: 'The complete article body.' });
  assert.equal(requests.length, 1);
});

test('spreadsheet articles without an imported full body never trigger a scrape', async () => {
  let calls = 0;
  await assert.rejects(loadFullArticle({ url: 'https://example.com/missing', title: 'Example', fromSpreadsheet: true }, { fetchImpl: async () => { calls++; throw new Error('Unexpected request'); } }), /No full body was provided/);
  assert.equal(calls, 0);
});

test('public export uses shared article bodies and does not start a scrape', async () => {
  const url = 'https://example.com/shared';
  const result = await loadFullArticle({ url, title: 'Shared story', fromSpreadsheet: true }, {
    cacheOnly: true, sharedLookup: async requested => {
      assert.equal(requested, url);
      return { heading: 'Shared story', body: 'The full shared article body.', translated: false };
    }, fetchImpl: async () => { throw new Error('Unexpected network scrape'); }
  });
  assert.equal(result.body, 'The full shared article body.');
});
