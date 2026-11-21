import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSiteConfig, normalizeSiteConfig } from './siteConfig.js';
import { dismissRejectedStory, pendingRejectedStories } from './rejectedReview.js';

test('rejected decisions persist for the same draft and reset for a newer scrape', () => {
  const config = defaultSiteConfig();
  const draft = { checkedAt: '2026-11-21T07:00:00Z', editorialRejections: [
    { id: 'one', title: 'First story', url: 'https://example.com/first' },
    { id: 'two', title: 'Second story', url: 'https://example.com/second' }
  ] };
  const dismissed = normalizeSiteConfig(dismissRejectedStory(config, draft.checkedAt, 'one'));
  assert.deepEqual(pendingRejectedStories(draft, dismissed).map(item => item.id), ['two']);
  assert.deepEqual(pendingRejectedStories({ ...draft, checkedAt: '2026-11-22T07:00:00Z' }, dismissed).map(item => item.id), ['one', 'two']);
});

test('already published rejected stories are removed from review by original URL', () => {
  const draft = { checkedAt: '2026-11-21T07:00:00Z', editorialRejections: [
    { id: 'one', title: 'First story', url: 'https://example.com/first?utm_source=rss' },
    { id: 'two', title: 'Second story', url: 'https://example.com/second' }
  ] };
  assert.deepEqual(pendingRejectedStories(draft, defaultSiteConfig(), [{ url: 'https://example.com/first' }]).map(item => item.id), ['two']);
});
