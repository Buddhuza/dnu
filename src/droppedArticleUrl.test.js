import test from 'node:test';
import assert from 'node:assert/strict';
import { droppedArticleUrl } from './droppedArticleUrl.js';

test('accepts an HTTPS article link dragged from a publisher page', () => {
  assert.equal(droppedArticleUrl('# article\nhttps://example.com/news/story', ''), 'https://example.com/news/story');
  assert.equal(droppedArticleUrl('', 'https://example.com/news/story'), 'https://example.com/news/story');
});

test('rejects a label or unsafe dropped URL', () => {
  assert.equal(droppedArticleUrl('', 'Read this article'), '');
  assert.equal(droppedArticleUrl('javascript:alert(1)', ''), '');
  assert.equal(droppedArticleUrl('http://example.com/story', ''), '');
});
