import test from 'node:test';
import assert from 'node:assert/strict';
import { grabArticleUrl } from './grabArticleUrl.js';

test('Grab accepts a copied publisher article link or dragged URI', () => {
  assert.equal(grabArticleUrl('https://www.example.com/politics/story?x=1', 'https://example.com/'), 'https://www.example.com/politics/story?x=1');
  assert.equal(grabArticleUrl('# browser drag\nhttps://news.example.com/story', 'https://example.com/'), 'https://news.example.com/story');
});

test('Grab ignores unrelated, unsafe, and source homepage links', () => {
  for (const value of ['https://other.com/story', 'javascript:alert(1)', 'https://example.com/', 'not a link']) {
    assert.equal(grabArticleUrl(value, 'https://example.com/'), '');
  }
});
