import test from 'node:test';
import assert from 'node:assert/strict';
import { collectionLogEntry, updateCollectionLog } from './write-native-collection-log.mjs';

test('successful manual collection records a useful description', () => {
  const entry = collectionLogEntry({ runId: 17, eventName: 'workflow_dispatch', conclusion: 'success',
    edition: { nativeEdition: true, articles: [{ body: 'Full article' }, { body: '' }], sourceOutcomes: [{ status: 'checked' }, { status: 'failed' }] },
    progress: { startedAt: '2026-11-20T08:00:00Z' }, finishedAt: '2026-11-20T08:06:00Z' });
  assert.equal(entry.trigger, 'manual');
  assert.equal(entry.outcome, 'succeeded');
  assert.match(entry.description, /2 stories.*1 route failed; 1 full article text/);
  assert.equal(entry.startedAt, '2026-11-20T08:00:00Z');
});

test('failed automatic collection retains the failure explanation and earlier runs', () => {
  const entry = collectionLogEntry({ runId: 18, eventName: 'schedule', conclusion: 'failure',
    progress: { state: 'failed', message: 'No qualifying articles. Previous edition retained.' }, finishedAt: '2026-11-20T13:05:00Z' });
  assert.equal(entry.trigger, 'automatic');
  assert.equal(entry.outcome, 'failed');
  assert.match(entry.description, /Previous edition retained/);
  const log = updateCollectionLog({ entries: [{ runId: 17, finishedAt: '2026-11-20T08:06:00Z' }] }, entry);
  assert.deepEqual(log.entries.map(item => item.runId), [18, 17]);
  assert.equal(updateCollectionLog(log, entry).entries.length, 2);
});

test('a completed collection remains successful when its report artifact is unavailable', () => {
  const entry = collectionLogEntry({ runId: 19, eventName: 'schedule', conclusion: 'success', finishedAt: '2026-11-20T13:06:00Z' });
  assert.equal(entry.outcome, 'succeeded');
  assert.match(entry.description, /detailed collection report was unavailable/);
});

test('a stale scheduled attempt is labelled skipped, not successful', () => {
  const entry = collectionLogEntry({ runId: 20, eventName: 'schedule', conclusion: 'success', skipped: true,
    finishedAt: '2026-11-20T16:00:00Z' });
  assert.equal(entry.outcome, 'skipped');
  assert.match(entry.description, /No scrape ran/);
});

test('an explicit catch-up trigger is manual', () => {
  const entry = collectionLogEntry({ runId: 21, eventName: 'push', conclusion: 'success',
    edition: { nativeEdition: true, articles: [{ body: '' }], sourceOutcomes: [] }, finishedAt: '2026-11-20T10:00:00Z' });
  assert.equal(entry.trigger, 'manual');
});
