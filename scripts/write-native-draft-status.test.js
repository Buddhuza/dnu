import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('manual drafts preserve the completed slot checkpoint and scheduled drafts advance it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dnu-slot-status-'));
  try {
    const editionPath = join(dir, 'edition.json'), statusPath = join(dir, 'status.json');
    writeFileSync(editionPath, JSON.stringify({ nativeEdition: true, checkedAt: '2026-11-20T09:00:00Z', articles: [{ id: 'a' }] }));
    writeFileSync(statusPath, JSON.stringify({ lastCompletedSlot: '2026-11-20T01:00 Europe/Vienna' }));
    const run = extra => execFileSync(process.execPath, ['scripts/write-native-draft-status.mjs', editionPath, statusPath], {
      cwd: new URL('..', import.meta.url), env: { ...process.env, GITHUB_RUN_ID: '123', ...extra }
    });
    run({ GITHUB_EVENT_NAME: 'workflow_dispatch', DNU_SCHEDULED_SLOT: '' });
    assert.equal(JSON.parse(readFileSync(statusPath)).lastCompletedSlot, '2026-11-20T01:00 Europe/Vienna');
    run({ GITHUB_EVENT_NAME: 'schedule', DNU_SCHEDULED_SLOT: '2026-11-20T13:00 Europe/Vienna' });
    assert.equal(JSON.parse(readFileSync(statusPath)).lastCompletedSlot, '2026-11-20T13:00 Europe/Vienna');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
