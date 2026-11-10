import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectionStatusForClient } from './nativeCollection.js';

test('collection status exposes a running scheduler and detects a stalled run', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dnu-collection-status-'));
  try {
    await mkdir(join(root, 'data'));
    const path = join(root, 'data', 'native-collection-progress.json');
    await writeFile(path, JSON.stringify({ state: 'running', startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), phase: 'routes', completed: 20, total: 749 }));
    assert.deepEqual([ (await collectionStatusForClient(root)).phase, (await collectionStatusForClient(root)).completed ], ['routes', 20]);
    await writeFile(path, JSON.stringify({ state: 'running', startedAt: '2020-01-01T00:00:00Z', updatedAt: '2020-01-01T00:00:00Z' }));
    assert.equal((await collectionStatusForClient(root)).state, 'failed');
  } finally { await rm(root, { recursive: true, force: true }); }
});
