import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

test('the article page reader requires an active editor and blocks private addresses', async () => {
  const originalDeno = globalThis.Deno;
  const originalFetch = globalThis.fetch;
  let handler, activeEditor = false;
  const pages = [];
  globalThis.Deno = {
    env: { get: key => ({ SUPABASE_URL: 'https://project.supabase.co', SUPABASE_ANON_KEY: 'public-key' })[key] },
    serve: callback => { handler = callback; },
    resolveDns: async (host, type) => type !== 'A' ? [] : host === 'intranet.example.com' ? ['10.0.0.5'] : ['93.184.216.34']
  };
  globalThis.fetch = async (url, options) => {
    if (String(url).endsWith('/auth/v1/user')) return Response.json({ id: 'editor-id' });
    if (String(url).includes('/rest/v1/dnu_editors')) return Response.json(activeEditor ? [{ active: true }] : []);
    pages.push(String(url));
    assert.equal(options.redirect, 'manual');
    if (String(url) === 'https://news.example.com/short') return new Response(null, { status: 301, headers: { location: '/article' } });
    if (String(url) === 'https://news.example.com/to-private') return new Response(null, { status: 302, headers: { location: 'https://intranet.example.com/' } });
    if (String(url) === 'https://news.example.com/article') return new Response('<html><title>Ok</title></html>', { headers: { 'content-type': 'text/html; charset=utf-8' } });
    return new Response('blocked', { status: 403, headers: { 'content-type': 'text/html' } });
  };
  try {
    const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
    const { code } = await transform(source, { loader: 'ts', format: 'esm' });
    await import(`data:text/javascript,${encodeURIComponent(code)}`);
    const call = url => handler(new Request('https://project.supabase.co/functions/v1/fetch-article-page', {
      method: 'POST', headers: { origin: 'https://buddhuza.github.io', authorization: 'Bearer editor-jwt', 'content-type': 'application/json' }, body: JSON.stringify({ url })
    }));
    assert.equal((await call('https://news.example.com/article')).status, 403);
    assert.equal(pages.length, 0);
    activeEditor = true;
    const ok = await call('https://news.example.com/short');
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { url: 'https://news.example.com/article', html: '<html><title>Ok</title></html>' });
    assert.equal((await call('http://news.example.com/article')).status, 400);
    assert.equal((await call('https://127.0.0.1/')).status, 400);
    assert.equal((await call('https://intranet.example.com/')).status, 400);
    assert.equal((await call('https://news.example.com/to-private')).status, 400);
    const refused = await call('https://news.example.com/paywalled');
    assert.equal(refused.status, 502);
    assert.match((await refused.json()).error, /refused automated access/);
  } finally {
    globalThis.Deno = originalDeno;
    globalThis.fetch = originalFetch;
  }
});
