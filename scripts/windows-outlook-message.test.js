import test from 'node:test';
import assert from 'node:assert/strict';
import { outlookMessageFromState } from './windows-outlook-message.mjs';

const article = { id: 'one', url: 'https://example.org/story', title: 'Ukraine and Moldova agree security talks', summary: 'Ministers will meet next week.', sourceName: 'Reuters', section: 'Eastern Europe', subsection: 'Ukraine', publishedAt: '2026-11-07T06:00:00Z' };
const state = { revision: 8, edition: { title: 'DAILY NEWS UPDATE', checkedAt: '2026-11-07T07:00:00Z', articles: [article], weekendAutomation: { date: '2026-11-07', status: 'prepared', delivery: 'windows' } }, settings: { version: 1 }, excluded_story_ids: [] };

test('Windows Outlook message uses the published visible edition and HTML report style', () => {
  const message = outlookMessageFromState(state, new Date('2026-11-07T07:00:00Z'));
  assert.equal(message.articleCount, 1);
  assert.match(message.subject, /07 November 2026/);
  assert.match(message.html, /Ukraine and Moldova agree security talks/);
  assert.match(message.html, /cid:dnu-osce-logo/);
});

test('Windows Outlook refuses an older, excluded or already emailed edition', () => {
  assert.throws(() => outlookMessageFromState(state, new Date('2026-11-08T07:00:00Z')), /no prepared/);
  assert.throws(() => outlookMessageFromState({ ...state, excluded_story_ids: ['one'] }, new Date('2026-11-07T07:00:00Z')), /no visible stories/);
  assert.throws(() => outlookMessageFromState({ ...state, edition: { ...state.edition, weekendAutomation: { date: '2026-11-07', status: 'accepted' } } }, new Date('2026-11-07T07:00:00Z')), /no prepared/);
  assert.throws(() => outlookMessageFromState({ ...state, edition: { ...state.edition, weekendAutomation: { date: '2026-11-07', status: 'prepared', delivery: 'graph' } } }, new Date('2026-11-07T07:00:00Z')), /no prepared/);
});
