import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

test('the scrape trigger verifies the editor before dispatching the fixed GitHub workflow', async () => {
  const originalDeno = globalThis.Deno;
  const originalFetch = globalThis.fetch;
  let handler;
  let dispatches = 0;
  let editorEmail = 'reader@example.com';
  globalThis.Deno = {
    env: { get: key => ({ SUPABASE_URL: 'https://project.supabase.co', SUPABASE_ANON_KEY: 'public-key', GITHUB_WORKFLOW_TOKEN: 'private-token' })[key] },
    serve: callback => { handler = callback; }
  };
  globalThis.fetch = async (url, options) => {
    if (String(url).endsWith('/auth/v1/user')) return Response.json({ email: editorEmail });
    if (String(url).endsWith('/runs?branch=main&per_page=1')) return Response.json({ workflow_runs: [] });
    if (String(url).endsWith('/dispatches')) {
      dispatches += 1;
      assert.equal(options.headers.authorization, 'Bearer private-token');
      assert.deepEqual(JSON.parse(options.body), { ref: 'main' });
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  try {
    const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
    const { code } = await transform(source, { loader: 'ts', format: 'esm' });
    await import(`data:text/javascript,${encodeURIComponent(code)}`);
    const request = () => new Request('https://project.supabase.co/functions/v1/start-dnu-collection', {
      method: 'POST', headers: { origin: 'https://buddhuza.github.io', authorization: 'Bearer editor-jwt' }
    });
    assert.equal((await handler(request())).status, 403);
    assert.equal(dispatches, 0);
    editorEmail = 'buddhuza@gmail.com';
    const response = await handler(request());
    assert.equal(response.status, 202);
    assert.equal((await response.json()).started, true);
    assert.equal(dispatches, 1);
  } finally {
    globalThis.Deno = originalDeno;
    globalThis.fetch = originalFetch;
  }
});
