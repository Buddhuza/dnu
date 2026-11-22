import test from 'node:test';
import assert from 'node:assert/strict';
import { extractCbsLiveBlogEntries } from './cbsLiveBlog.js';
import { excludedHeadlineReason } from '../src/headlinePolicy.js';
import { canonicalArticleUrl } from '../src/siteConfig.js';

const parent = { link: 'https://www.cbsnews.com/live-updates/iran-war-latest/', source: 'CBS', sourceDomain: 'cbsnews.com' };
const body = 'Two tankers were struck near the Strait of Hormuz on Saturday. Maritime authorities reported damage to both vessels and warned shipping companies to avoid the area. Officials were investigating the cause of the attacks.';

test('CBS copy links identify separate posts on the same live page', () => {
  const html = ['a1b2c3d4', 'a1b2c3d5'].map((id, index) => `<section class="content__post post-update" data-sort-time="${1795335300000 - index * 900000}"><a class="post-update__anchor-link" name="post-update-${id}"></a><h2 class="post-update__headline">${index ? 'Iran reports further attacks on shipping near Hormuz' : 'Two tankers attacked near Strait of Hormuz'}</h2><div class="post-update__bodytext"><p>${body}</p></div><div class="sharebar__textarea">${parent.link}#post-update-${id}</div></section>`).join('');
  const entries = extractCbsLiveBlogEntries(html, parent);
  assert.equal(entries.length, 2);
  assert.notEqual(canonicalArticleUrl(entries[0].link), canonicalArticleUrl(entries[1].link));
  assert.equal(excludedHeadlineReason('Iran war live: latest', '', parent.link), 'Live blogs are excluded');
  assert.equal(excludedHeadlineReason(entries[0].headline, '', entries[0].link), '');
});
