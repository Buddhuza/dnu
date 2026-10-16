import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceAudit } from './collectionAudit.js';

const source = { id: 'source-1', name: 'Test News' };
const attempt = (extra = {}) => ({ listingUrl: 'https://example.com/news', collectionMethod: 'firecrawl', listedCount: 12, candidatesFound: 4, candidatesChecked: 4, headlines: 0, rejectionCounts: { pageError: 0, missingHeadlineOrTime: 0, outsideWindow: 0, outsideScope: 0 }, ...extra });

test('source audit aggregates pages and identifies verified extraction', () => {
  const result = sourceAudit(source, [attempt({ candidatesChecked: 2, headlines: 1 }), attempt({ candidatesChecked: 2, headlines: 2 })]);
  assert.equal(result.status, 'extracted');
  assert.equal(result.attempts.length, 1);
  assert.equal(result.attempts[0].candidatesChecked, 4);
  assert.match(result.reason, /3 dated, matching articles/);
});

test('source audit distinguishes failed pages, missing dates, and old articles', () => {
  assert.equal(sourceAudit(source, [attempt({ rejectionCounts: { pageError: 2 } })]).status, 'article-errors');
  assert.equal(sourceAudit(source, [attempt({ rejectionCounts: { missingHeadlineOrTime: 4 } })]).status, 'unverified-articles');
  assert.equal(sourceAudit(source, [attempt({ rejectionCounts: { outsideWindow: 4 } })]).status, 'outside-window');
});

test('source audit reports missing listing links and keyword mismatches', () => {
  assert.equal(sourceAudit(source, [attempt({ listedCount: 0, candidatesFound: 0, candidatesChecked: 0 })]).status, 'empty-listing');
  assert.equal(sourceAudit(source, [attempt({ candidatesFound: 0, candidatesChecked: 0 })]).status, 'no-matching-links');
  assert.equal(sourceAudit(source, [], ['Firecrawl blocked access']).status, 'failed');
});

test('source audit identifies articles skipped from the previous update', () => {
  const result = sourceAudit(source, [attempt({ listedCount: 2, previouslyCovered: 2, candidatesFound: 0, candidatesChecked: 0 })]);
  assert.equal(result.status, 'previously-covered');
  assert.match(result.reason, /2 articles were already covered/);
});
