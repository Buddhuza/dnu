import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureCollectionData } from './dataDirectory.js';
import { readCompletedEdition } from './nativeEdition.js';

test('a fresh persistent volume starts with the bundled completed edition', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dnu-api-data-'));
  try {
    ensureCollectionData(directory);
    const path = join(directory, 'prepared-update.json');
    assert.ok(JSON.parse(readFileSync(path, 'utf8')).articles.length > 0);
    assert.ok(readCompletedEdition(path).articles.length > 0);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
