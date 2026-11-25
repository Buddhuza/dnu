// Deploy with: supabase functions deploy fetch-article-page --project-ref epghsyajgspcywqqbfso
// Editor-only: fetches one public article page so Add article → Use URL can suggest its fields.
// It returns the page HTML; parsing happens in the editor's browser with the shared DNU extractors.
const allowedOrigins = new Set(['https://buddhuza.github.io', 'http://localhost:5173', 'http://127.0.0.1:5173']);
const maxBytes = 3_000_000;
const maxRedirects = 5;
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

function privateAddress(address: string): boolean {
  const value = address.toLowerCase().replace(/^\[|\]$/g, '');
  if (value.includes(':')) {
    const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    if (mapped) return privateAddress(mapped);
    return value === '::' || value === '::1' || /^(?:fc|fd|fe[89ab])/.test(value);
  }
  const parts = value.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19));
}

function publicPageUrl(value: unknown) {
  try {
    const url = new URL(String(value));
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !host.includes('.') ||
      host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost') ||
      /^[\d.]+$/.test(host) || host.includes(':') || host.startsWith('[') || url.href.length > 400) return null;
    return url;
  } catch { return null; }
}

async function resolvesPublicly(host: string) {
  const resolve = (globalThis as { Deno?: { resolveDns?: (name: string, type: string) => Promise<string[]> } }).Deno?.resolveDns;
  if (typeof resolve !== 'function') return true;
  const answers = (await Promise.all(['A', 'AAAA'].map(type => resolve(host, type).catch(() => [] as string[])))).flat();
  return answers.length > 0 && answers.every(address => !privateAddress(address));
}

Deno.serve(async request => {
  const origin = request.headers.get('origin') || '';
  const cors = {
    'access-control-allow-origin': allowedOrigins.has(origin) ? origin : 'https://buddhuza.github.io',
    'access-control-allow-headers': 'authorization, apikey, x-client-info, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    vary: 'Origin'
  };
  const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), {
    status, headers: { ...cors, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return reply(405, { error: 'Use POST to read an article page.' });
  if (origin && !allowedOrigins.has(origin)) return reply(403, { error: 'This site cannot read article pages.' });

  const jwt = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!jwt || !supabaseUrl || !supabaseKey) return reply(401, { error: 'Sign in as the editor first.' });

  let target = publicPageUrl((await request.json().catch(() => ({})))?.url);
  if (!target) return reply(400, { error: 'Enter a public HTTPS article URL.' });

  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { authorization: `Bearer ${jwt}`, apikey: supabaseKey } });
    if (!userResponse.ok) return reply(401, { error: 'Your editor session has expired. Sign in again.' });
    const user = await userResponse.json();
    const editorResponse = await fetch(`${supabaseUrl}/rest/v1/dnu_editors?user_id=eq.${encodeURIComponent(user.id)}&select=active`, {
      headers: { authorization: `Bearer ${jwt}`, apikey: supabaseKey }
    });
    const activeEditor = editorResponse.ok && (await editorResponse.json())?.[0]?.active === true;
    if (!activeEditor) return reply(403, { error: 'Only an active DNU editor can read article pages.' });
  } catch (error) {
    console.error('Editor check failed', error);
    return reply(502, { error: 'Could not verify the editor session.' });
  }

  try {
    let response: Response | null = null;
    for (let hop = 0; hop <= maxRedirects; hop += 1) {
      if (!await resolvesPublicly(target.hostname)) return reply(400, { error: 'This URL does not point to a public website.' });
      response = await fetch(target.href, {
        redirect: 'manual',
        headers: { 'user-agent': userAgent, accept: 'text/html,application/xhtml+xml', 'accept-language': 'en;q=0.9,*;q=0.5' },
        signal: AbortSignal.timeout(15000)
      });
      if (response.status < 300 || response.status >= 400) break;
      const next = publicPageUrl(new URL(response.headers.get('location') || '', target).href);
      await response.body?.cancel();
      if (!next) return reply(502, { error: 'The publisher redirected to an address that cannot be read.' });
      target = next;
      response = null;
    }
    if (!response) return reply(502, { error: 'The publisher redirected too many times.' });
    if (!response.ok) {
      await response.body?.cancel();
      return reply(502, { error: response.status === 401 || response.status === 403 || response.status === 429
        ? `The publisher refused automated access (HTTP ${response.status}). Paste the text yourself.`
        : `The publisher returned HTTP ${response.status}.` });
    }
    if (!/text\/html|application\/xhtml/i.test(response.headers.get('content-type') || '')) {
      await response.body?.cancel();
      return reply(415, { error: 'The URL is not an HTML article page.' });
    }
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      if (size + value.byteLength > maxBytes) { chunks.push(value.subarray(0, maxBytes - size)); size = maxBytes; await reader.cancel(); break; }
      chunks.push(value);
      size += value.byteLength;
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const charset = (response.headers.get('content-type') || '').match(/charset=["']?([\w-]+)/i)?.[1] || 'utf-8';
    let html: string;
    try { html = new TextDecoder(charset).decode(bytes); } catch { html = new TextDecoder().decode(bytes); }
    return reply(200, { url: target.href, html });
  } catch (error) {
    console.error('Article fetch failed', error);
    return reply(502, { error: error instanceof DOMException && error.name === 'TimeoutError' ? 'The publisher did not respond in time.' : 'The article page could not be reached.' });
  }
});
