// Invoked by Supabase Cron. The shared token stays in Vault and Edge secrets.
const workflowApi = 'https://api.github.com/repos/Buddhuza/dnu/actions/workflows/send-dnu-gmail.yml/dispatches';
const clock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});

function equalSecret(left: string, right: string) {
  if (!left || !right || left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
}

Deno.serve(async request => {
  const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
  if (request.method !== 'POST') return reply(405, { error: 'Use POST.' });
  const expected = Deno.env.get('DNU_SCHEDULE_TOKEN') || '';
  if (!equalSecret(request.headers.get('x-dnu-schedule-token') || '', expected))
    return reply(401, { error: 'Unauthorised scheduler.' });

  const now = Object.fromEntries(clock.formatToParts(new Date()).map(part => [part.type, part.value]));
  if (now.hour !== '13' || !['30', '40', '50'].includes(now.minute))
    return reply(200, { skipped: true, reason: 'Outside the Vienna email slots.' });
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const githubToken = Deno.env.get('GITHUB_WORKFLOW_TOKEN');
  if (!supabaseUrl || !serviceKey || !githubToken) return reply(503, { error: 'Scheduler credentials are missing.' });

  try {
    const state = await fetch(`${supabaseUrl}/rest/v1/dnu_state?id=eq.main&select=revision,edition`, {
      headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` }
    });
    if (!state.ok) return reply(502, { error: 'Could not check the published update.' });
    const published = (await state.json())?.[0];
    if (!Number.isSafeInteger(Number(published?.revision)) || !published?.edition?.articles?.length)
      return reply(409, { error: 'No published stories are available to email.' });

    const date = `${now.year}-${now.month}-${now.day}`;
    const dispatch = await fetch(workflowApi, {
      method: 'POST',
      headers: { authorization: `Bearer ${githubToken}`, accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28', 'content-type': 'application/json' },
      body: JSON.stringify({ ref: 'main', inputs: { expected_revision: String(published.revision),
        headline_only: 'false', request_id: `auto-${date}`, scheduled_delivery: 'true' } })
    });
    if (!dispatch.ok) return reply(502, { error: `Could not queue Gmail delivery (HTTP ${dispatch.status}).` });
    return reply(202, { queued: true, date });
  } catch (error) {
    console.error('Scheduled DNU email dispatch failed', error);
    return reply(502, { error: 'Could not reach the email delivery service.' });
  }
});
