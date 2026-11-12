// Deploy with: supabase functions deploy start-dnu-collection --project-ref epghsyajgspcywqqbfso
// Store a fine-grained GitHub token in the function's GITHUB_WORKFLOW_TOKEN secret.
const allowedOrigins = new Set(['https://buddhuza.github.io', 'http://localhost:5173', 'http://127.0.0.1:5173']);
const githubHeaders = (token: string) => ({
  authorization: `Bearer ${token}`,
  accept: 'application/vnd.github+json',
  'x-github-api-version': '2022-11-28'
});
const workflowApi = 'https://api.github.com/repos/Buddhuza/dnu/actions/workflows/test-daily-collection.yml';

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
  if (request.method !== 'POST') return reply(405, { error: 'Use POST to start a collection.' });
  if (origin && !allowedOrigins.has(origin)) return reply(403, { error: 'This site cannot start a collection.' });

  const jwt = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
  const githubToken = Deno.env.get('GITHUB_WORKFLOW_TOKEN');
  if (!jwt || !supabaseUrl || !supabaseKey) return reply(401, { error: 'Sign in as the editor first.' });
  if (!githubToken) return reply(503, { error: 'One-click scraping needs the GitHub workflow token in the Supabase function secrets.' });

  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { authorization: `Bearer ${jwt}`, apikey: supabaseKey }
    });
    if (!userResponse.ok) return reply(401, { error: 'Your editor session has expired. Sign in again.' });
    const user = await userResponse.json();
    if (String(user.email || '').toLowerCase() !== 'buddhuza@gmail.com')
      return reply(403, { error: 'Only the DNU editor can start a collection.' });

    const runsResponse = await fetch(`${workflowApi}/runs?branch=main&per_page=1`, { headers: githubHeaders(githubToken) });
    if (!runsResponse.ok) return reply(502, { error: 'GitHub could not check the current collection status.' });
    const latest = (await runsResponse.json()).workflow_runs?.[0];
    if (latest && latest.status !== 'completed')
      return reply(409, { error: 'A collection is already running.', runUrl: latest.html_url });

    const dispatch = await fetch(`${workflowApi}/dispatches`, {
      method: 'POST', headers: { ...githubHeaders(githubToken), 'content-type': 'application/json' },
      body: JSON.stringify({ ref: 'main' })
    });
    if (!dispatch.ok) {
      const detail = await dispatch.text();
      console.error('GitHub workflow dispatch failed', dispatch.status, detail.slice(0, 500));
      return reply(502, { error: dispatch.status === 401 || dispatch.status === 403
        ? 'The GitHub workflow token cannot start this job. Check its repository Actions permission.'
        : 'GitHub could not start the collection.' });
    }
    return reply(202, { started: true, message: 'GitHub accepted the collection request.' });
  } catch (error) {
    console.error('Collection dispatch failed', error);
    return reply(502, { error: 'The collection request could not reach GitHub.' });
  }
});
