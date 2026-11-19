import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAutosendStatus } from './write-autosend-status.mjs';

const base = { GITHUB_RUN_ID: '123', GITHUB_REPOSITORY: 'Buddhuza/dnu', GITHUB_SHA: 'abc123',
  AUTOSEND_CREDENTIALS_OUTCOME: 'success', AUTOSEND_DRAFT_OUTCOME: 'success',
  AUTOSEND_PUBLISH_OUTCOME: 'success', AUTOSEND_EMAIL_OUTCOME: 'success' };

test('records a completed email submission without storing recipient details', () => {
  const status = buildAutosendStatus(base, { checkedAt: '2026-11-19T19:51:51Z', stories: 82, runId: 456 }, new Date('2026-11-19T22:00:00Z'));
  assert.equal(status.result, 'email_submitted');
  assert.equal(status.draft.stories, 82);
  assert.equal(status.runUrl, 'https://github.com/Buddhuza/dnu/actions/runs/123');
  assert.equal(status.finishedAt, '2026-11-19T22:00:00.000Z');
});

test('distinguishes publication from failed email and reports pre-publication failure', () => {
  assert.equal(buildAutosendStatus({ ...base, AUTOSEND_EMAIL_OUTCOME: 'failure' }, null).result, 'published_email_unconfirmed');
  assert.equal(buildAutosendStatus({ ...base, AUTOSEND_PUBLISH_OUTCOME: 'failure', AUTOSEND_EMAIL_OUTCOME: 'skipped' }, null).result, 'publication_unconfirmed');
  assert.equal(buildAutosendStatus({ ...base, AUTOSEND_PUBLISH_OUTCOME: 'skipped', AUTOSEND_EMAIL_OUTCOME: 'skipped' }, null).result, 'not_published');
});
