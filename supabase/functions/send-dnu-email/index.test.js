import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

test('Gmail trigger accepts active editors, fixes the workflow and checks the published revision', async () => {
  const originalDeno = globalThis.Deno;
  const originalFetch = globalThis.fetch;
  let handler, role = 'inactive', active = false, revision = 7, dispatches = 0;
  globalThis.Deno = {
    env: { get: key => ({ SUPABASE_URL: 'https://project.supabase.co', SUPABASE_ANON_KEY: 'public-key', GITHUB_WORKFLOW_TOKEN: 'private-token' })[key] },
    serve: callback => { handler = callback; }
  };
  globalThis.fetch = async (url, options) => {
    if (String(url).endsWith('/auth/v1/user')) return Response.json({ id: 'owner-id', email: 'owner@example.com' });
    if (String(url).includes('/rest/v1/dnu_editors')) return Response.json([{ active, role }]);
    if (String(url).includes('/rest/v1/dnu_state')) return Response.json([{ revision }]);
    if (String(url).endsWith('/dispatches')) {
      dispatches += 1;
      assert.match(String(url), /send-dnu-gmail\.yml/);
      assert.equal(options.headers.authorization, 'Bearer private-token');
      const payload = JSON.parse(options.body);
      assert.equal(payload.ref, 'main');
      assert.equal(payload.inputs.expected_revision, '7');
      assert.equal(payload.inputs.headline_only, 'true');
      assert.ok(payload.inputs.request_id);
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  try {
    const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
    const { code } = await transform(source, { loader: 'ts', format: 'esm' });
    await import(`data:text/javascript,${encodeURIComponent(code)}`);
    const request = () => new Request('https://project.supabase.co/functions/v1/send-dnu-email', {
      method: 'POST', headers: { origin: 'https://buddhuza.github.io', authorization: 'Bearer owner-jwt' },
      body: JSON.stringify({ expectedRevision: 7, headlineOnly: true })
    });
    assert.equal((await handler(request())).status, 403);
    role = 'editor'; active = true; revision = 8;
    assert.equal((await handler(request())).status, 409);
    revision = 7;
    const response = await handler(request());
    assert.equal(response.status, 202);
    assert.equal((await response.json()).queued, true);
    assert.equal(dispatches, 1);
    role = 'owner';
    assert.equal((await handler(request())).status, 202);
  } finally {
    globalThis.Deno = originalDeno;
    globalThis.fetch = originalFetch;
  }
});
