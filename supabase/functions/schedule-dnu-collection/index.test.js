import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

test('independent recovery dispatches only when the current Vienna slot is missing', async () => {
  const originalDeno = globalThis.Deno, originalFetch = globalThis.fetch, OriginalDate = globalThis.Date;
  let handler, completed = true, running = false, dispatches = 0;
  globalThis.Date = class extends OriginalDate {
    constructor(...args) { super(...(args.length ? args : ['2026-11-20T05:00:00Z'])); }
  };
  globalThis.Deno = { env: { get: key => ({ DNU_SCHEDULE_TOKEN: 'shared-secret', GITHUB_WORKFLOW_TOKEN: 'workflow-token' })[key] },
    serve: callback => { handler = callback; } };
  globalThis.fetch = async (url, options) => {
    if (String(url).includes('native-draft-status.json')) return Response.json({ lastCompletedSlot: completed ? '2026-11-20T01:00 Europe/Vienna' : '2026-11-19T13:00 Europe/Vienna' });
    if (String(url).endsWith('/runs?branch=main&per_page=1')) return Response.json({ workflow_runs: running ? [{ status: 'in_progress' }] : [] });
    if (String(url).endsWith('/dispatches')) {
      dispatches++;
      assert.equal(options.headers.authorization, 'Bearer workflow-token');
      assert.deepEqual(JSON.parse(options.body), { ref: 'main', inputs: { scheduled_recovery: 'true' } });
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  try {
    const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
    const { code } = await transform(source, { loader: 'ts', format: 'esm' });
    await import(`data:text/javascript,${encodeURIComponent(code)}`);
    const request = secret => new Request('https://project.supabase.co/functions/v1/schedule-dnu-collection', {
      method: 'POST', headers: { 'x-dnu-schedule-token': secret }
    });
    assert.equal((await handler(request('wrong'))).status, 401);
    assert.equal((await handler(request('shared-secret'))).status, 200);
    completed = false;
    running = true;
    assert.equal((await handler(request('shared-secret'))).status, 200);
    running = false;
    const response = await handler(request('shared-secret'));
    assert.equal(response.status, 202);
    assert.equal((await response.json()).slot, '2026-11-20T01:00 Europe/Vienna');
    assert.equal(dispatches, 1);
  } finally {
    globalThis.Deno = originalDeno;
    globalThis.fetch = originalFetch;
    globalThis.Date = OriginalDate;
  }
});
