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
