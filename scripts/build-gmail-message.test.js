import test from 'node:test';
import assert from 'node:assert/strict';
import { gmailMessageFromState } from './build-gmail-message.mjs';
import { defaultSiteConfig } from '../src/siteConfig.js';

const articles = [
  { id: 'visible', title: 'New talks begin', summary: 'Delegates met in Vienna', section: 'Eastern Europe', subsection: 'Ukraine', url: 'https://example.com/visible', sourceName: 'Reuters' },
  { id: 'excluded', title: 'Old talks end', section: 'Eastern Europe', subsection: 'Ukraine', url: 'https://example.com/excluded', sourceName: 'AP' }
];
const state = {
  revision: 7, compiled_at: '2026-11-18T08:00:00Z',
  edition: { articles, checkedAt: '2026-11-18T07:00:00Z' },
  settings: defaultSiteConfig(articles), excluded_story_ids: ['excluded']
};

test('Gmail message contains only the visible published update and inline logo', () => {
  const full = gmailMessageFromState(state, 7, false);
  assert.equal(full.articleCount, 1);
  assert.match(full.html, /cid:dnu-osce-logo/);
  assert.match(full.html, /Delegates met in Vienna/);
  assert.doesNotMatch(full.html, /Old talks end/);
  const compressed = gmailMessageFromState(state, 7, true);
  assert.doesNotMatch(compressed.html, /Delegates met in Vienna/);
  assert.equal(compressed.subject, full.subject);
});

test('Gmail refuses an edition changed since the button was pressed', () => {
  assert.throws(() => gmailMessageFromState(state, 6), /changed before email delivery/);
});
