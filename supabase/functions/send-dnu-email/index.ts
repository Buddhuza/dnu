// The site never receives Gmail credentials. This function verifies the owner
// and queues the fixed-recipient delivery workflow.
const workflowApi = 'https://api.github.com/repos/Buddhuza/dnu/actions/workflows/send-dnu-gmail.yml';
const allowedOrigins = new Set(['https://buddhuza.github.io', 'http://localhost:5173', 'http://127.0.0.1:5173']);

Deno.serve(async request => {
  const origin = request.headers.get('origin') || '';
  const cors = {
    'access-control-allow-origin': allowedOrigins.has(origin) ? origin : 'https://buddhuza.github.io',
    'access-control-allow-headers': 'authorization, apikey, x-client-info, content-type',
    'access-control-allow-methods': 'POST, OPTIONS', vary: 'Origin'
  };
  const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), {
    status, headers: { ...cors, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return reply(405, { error: 'Use POST to send the update.' });
  if (origin && !allowedOrigins.has(origin)) return reply(403, { error: 'This site cannot send the update.' });

  const jwt = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
  const githubToken = Deno.env.get('GITHUB_WORKFLOW_TOKEN');
  if (!jwt || !supabaseUrl || !supabaseKey) return reply(401, { error: 'Sign in as the owner first.' });
  if (!githubToken) return reply(503, { error: 'Email delivery is not configured yet.' });
  let input: { headlineOnly?: boolean; expectedRevision?: number };
  try { input = await request.json(); } catch { return reply(400, { error: 'Invalid send request.' }); }
  if (!input || typeof input.headlineOnly !== 'boolean' || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision! < 0)
    return reply(400, { error: 'Invalid send request.' });

  try {
    const headers = { authorization: `Bearer ${jwt}`, apikey: supabaseKey };
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers });
    if (!userResponse.ok) return reply(401, { error: 'Your session has expired. Sign in again.' });
    const user = await userResponse.json();
    const editorResponse = await fetch(`${supabaseUrl}/rest/v1/dnu_editors?user_id=eq.${encodeURIComponent(user.id)}&select=role,active`, { headers });
    const owner = editorResponse.ok && (await editorResponse.json())?.[0];
    const legacyOwner = editorResponse.status === 404 && String(user.email || '').toLowerCase() === 'buddhuza@gmail.com';
    if (!(owner?.active === true && owner.role === 'owner') && !legacyOwner)
      return reply(403, { error: 'Only the DNU owner can send this email.' });

    const stateResponse = await fetch(`${supabaseUrl}/rest/v1/dnu_state?id=eq.main&select=revision`, { headers });
    if (!stateResponse.ok) return reply(502, { error: 'Could not check the published update.' });
    const revision = (await stateResponse.json())?.[0]?.revision;
    if (Number(revision) !== input.expectedRevision)
      return reply(409, { error: 'The published update has changed. Reload the page before sending.' });

    const requestId = crypto.randomUUID();
    const dispatch = await fetch(`${workflowApi}/dispatches`, {
      method: 'POST', headers: { authorization: `Bearer ${githubToken}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'content-type': 'application/json' },
      body: JSON.stringify({ ref: 'main', inputs: { expected_revision: String(revision), headline_only: String(input.headlineOnly), request_id: requestId } })
    });
    if (!dispatch.ok) return reply(502, { error: 'Could not queue the email. Check delivery setup.' });
    return reply(202, { queued: true, requestId, message: 'Email queued for the two recipients.' });
  } catch (error) {
    console.error('DNU email dispatch failed', error);
    return reply(502, { error: 'Could not reach the email delivery service.' });
  }
});
