import test from 'node:test';
import assert from 'node:assert/strict';
import { droppedArticleUrl } from './dropArticleUrl.js';

test('accepts a dragged HTTPS article link', () => {
  const transfer = { getData: type => type === 'text/uri-list' ? '# page title\nhttps://example.org/news/story' : 'Story headline' };
  assert.equal(droppedArticleUrl(transfer), 'https://example.org/news/story');
});

test('uses a plain URL when the browser does not supply a URI list', () => {
  const transfer = { getData: type => type === 'text/plain' ? 'https://example.org/news/story' : '' };
  assert.equal(droppedArticleUrl(transfer), 'https://example.org/news/story');
});

test('ignores text and non-HTTPS links', () => {
  const transfer = { getData: type => type === 'text/uri-list' ? 'http://example.org/story' : 'A news headline' };
  assert.equal(droppedArticleUrl(transfer), '');
});
