// Independent hourly recovery trigger for the 01:00 and 13:00 Vienna slots.
// Supabase Cron sends the token from Vault; the GitHub workflow checks the
// completed-slot marker again before collecting.
const workflowApi = 'https://api.github.com/repos/Buddhuza/dnu/actions/workflows/test-daily-collection.yml';
const draftStatusUrl = 'https://buddhuza.github.io/dnu/native-draft-status.json';
const clock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', hourCycle: 'h23'
});

function equalSecret(left: string, right: string) {
  if (!left || !right || left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
}

function latestSlot(now: Date) {
  const parts = Object.fromEntries(clock.formatToParts(now).map(part => [part.type, part.value]));
  const hour = Number(parts.hour);
  if (hour >= 1) return `${parts.year}-${parts.month}-${parts.day}T${hour >= 13 ? '13' : '01'}:00 Europe/Vienna`;
  const previous = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) - 1));
  return `${previous.toISOString().slice(0, 10)}T13:00 Europe/Vienna`;
}

Deno.serve(async request => {
  const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
  if (request.method !== 'POST') return reply(405, { error: 'Use POST.' });
  if (!equalSecret(request.headers.get('x-dnu-schedule-token') || '', Deno.env.get('DNU_SCHEDULE_TOKEN') || ''))
    return reply(401, { error: 'Unauthorised scheduler.' });
  const githubToken = Deno.env.get('GITHUB_WORKFLOW_TOKEN');
  if (!githubToken) return reply(503, { error: 'GitHub workflow token is unavailable.' });
  const slot = latestSlot(new Date());
  const headers = { authorization: `Bearer ${githubToken}`, accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28' };
  try {
    const statusResponse = await fetch(`${draftStatusUrl}?t=${Date.now()}`, { cache: 'no-store' });
    if (statusResponse.ok && (await statusResponse.json()).lastCompletedSlot === slot)
      return reply(200, { skipped: true, reason: 'The Vienna slot is complete.', slot });
    const runsResponse = await fetch(`${workflowApi}/runs?branch=main&per_page=1`, { headers });
    if (!runsResponse.ok) return reply(502, { error: 'Could not check the current collection run.', slot });
    const latest = (await runsResponse.json()).workflow_runs?.[0];
    if (latest && latest.status !== 'completed')
      return reply(200, { skipped: true, reason: 'A collection workflow is already running.', slot });
    const dispatch = await fetch(`${workflowApi}/dispatches`, {
      method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ ref: 'main', inputs: { scheduled_recovery: 'true' } })
    });
    if (!dispatch.ok) return reply(502, { error: `Could not queue the recovery collection (HTTP ${dispatch.status}).`, slot });
    return reply(202, { queued: true, slot });
  } catch (error) {
    console.error('Scheduled collection recovery failed', error);
    return reply(502, { error: 'Could not reach the collection service.', slot });
  }
});
