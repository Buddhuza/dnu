import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { articleBookmarklet, articleUrlFromQuery } from './articleHandoff.js';

test('bookmarklet sends the current publisher URL to Add', () => {
  let opened;
  const publisher = 'https://publisher.example/story?id=7#details';
  const code = articleBookmarklet('https://buddhuza.github.io/dnu/#lead').slice('javascript:'.length);
  runInNewContext(code, {
    location: { href: publisher },
    window: { open: (url, name) => { opened = { url, name }; return {}; } },
    encodeURIComponent
  });
  assert.equal(opened.name, 'dnu_article_add');
  assert.equal(articleUrlFromQuery(new URL(opened.url).search), publisher);
});

test('bookmarklet falls back to navigation when a new tab is blocked', () => {
  const location = { href: 'https://publisher.example/story' };
  const code = articleBookmarklet('https://buddhuza.github.io/dnu/').slice('javascript:'.length);
  runInNewContext(code, { location, window: { open: () => null }, encodeURIComponent });
  assert.equal(articleUrlFromQuery(new URL(location.href).search), 'https://publisher.example/story');
});

test('Add only accepts an HTTPS article URL from the query', () => {
  assert.equal(articleUrlFromQuery('?add=http%3A%2F%2Fexample.org%2Fstory'), '');
  assert.equal(articleUrlFromQuery('?add=not-a-url'), '');
});
