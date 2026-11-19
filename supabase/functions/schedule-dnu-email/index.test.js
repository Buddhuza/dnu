import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

test('scheduled email requires its secret and queues the published revision in the Vienna slot', async () => {
  const original = { Deno: globalThis.Deno, fetch: globalThis.fetch, Date: globalThis.Date };
  let handler, dispatches = 0;
  globalThis.Date = class extends Date { constructor(...args) { super(...(args.length ? args : ['2026-11-19T15:00:00Z'])); } };
  globalThis.Deno = {
    env: { get: key => ({ DNU_SCHEDULE_TOKEN: 'private-scheduler', SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-key', GITHUB_WORKFLOW_TOKEN: 'github-token' })[key] },
    serve: callback => { handler = callback; }
  };
  globalThis.fetch = async (url, options) => {
    if (String(url).includes('/rest/v1/dnu_state')) return Response.json([{ revision: 9, edition: { articles: [{ id: 'story' }] } }]);
    if (String(url).endsWith('/dispatches')) {
      dispatches++;
      const inputs = JSON.parse(options.body).inputs;
      assert.equal(inputs.expected_revision, '9');
      assert.equal(inputs.request_id, 'auto-2026-11-19');
      assert.equal(inputs.scheduled_delivery, 'true');
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  try {
    const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
    const { code } = await transform(source, { loader: 'ts', format: 'esm' });
    await import(`data:text/javascript,${encodeURIComponent(code)}`);
    const request = token => new Request('https://project.supabase.co/functions/v1/schedule-dnu-email', {
      method: 'POST', headers: { 'x-dnu-schedule-token': token }
    });
    assert.equal((await handler(request('wrong'))).status, 401);
    assert.equal((await handler(request('private-scheduler'))).status, 202);
    assert.equal(dispatches, 1);
  } finally {
    globalThis.Deno = original.Deno;
    globalThis.fetch = original.fetch;
    globalThis.Date = original.Date;
  }
});
