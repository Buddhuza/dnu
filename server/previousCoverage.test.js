import test from 'node:test';
import assert from 'node:assert/strict';
import { previousCoverageIndex, previousCoverageReason } from './previousCoverage.js';

test('previously covered links are skipped before an article scrape', () => {
  const index = previousCoverageIndex([{ url: 'https://www.example.com/story?utm_source=feed', title: 'Leaders agree on border talks' }]);
  assert.equal(previousCoverageReason({ url: 'https://example.com/story/', title: 'Different listing headline' }, index), 'same URL');
  assert.equal(previousCoverageReason({ url: 'https://other.example/story', title: 'Leaders agree on border talks!' }, index), 'same headline');
  assert.equal(previousCoverageReason({ url: 'https://other.example/new', title: 'Leaders sign border agreement' }, index), null);
});
