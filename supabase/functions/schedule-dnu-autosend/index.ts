// Supabase Cron calls this every five minutes. Missed GitHub starts are retried
// until a successful Gmail submission is recorded for each Vienna date.
const githubApi = 'https://api.github.com/repos/Buddhuza/dnu';
const startDate = '2026-11-20';
const testDate = '2026-11-20';

function sameSecret(left: string, right: string) {
  if (!left || !right || left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
}

function viennaNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date()).map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

Deno.serve(async request => {
  const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
  if (request.method !== 'POST') return reply(405, { error: 'Use POST.' });
  if (!sameSecret(request.headers.get('x-dnu-schedule-token') || '', Deno.env.get('DNU_SCHEDULE_TOKEN') || ''))
    return reply(401, { error: 'Unauthorised scheduler.' });
  const token = Deno.env.get('GITHUB_WORKFLOW_TOKEN');
  if (!token) return reply(503, { error: 'Workflow token is unavailable.' });
  const headers = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28' };
  try {
    let history: Record<string, string> = {};
    const record = await fetch(`${githubApi}/contents/history.json?ref=autosend-status`, { headers });
    if (record.ok) {
      const payload = await record.json();
      history = JSON.parse(atob(String(payload.content || '').replace(/\s/g, '')));
    } else if (record.status !== 404) return reply(502, { error: `Could not check AUTOSEND history (HTTP ${record.status}).` });
    const current = viennaNow();
    const holidays: string[] = []; // Add the owner's holiday dates here when supplied.
    let due = '';
    for (let day = new Date(`${startDate}T12:00:00Z`); day.toISOString().slice(0, 10) <= current.date; day.setUTCDate(day.getUTCDate() + 1)) {
      const date = day.toISOString().slice(0, 10);
      const weekday = day.getUTCDay();
      if (date !== testDate && weekday !== 0 && weekday !== 6 && !holidays.includes(date)) continue;
      if (history[date] === 'email_submitted') continue;
      if (date === current.date && current.time < (date === testDate ? '22:15' : '08:00')) continue;
      due = date;
      break;
    }
    if (!due) return reply(200, { skipped: true, reason: 'No unsent weekend, holiday or test date is due.' });
    const dispatch = await fetch(`${githubApi}/actions/workflows/autosend.yml/dispatches`, {
      method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ ref: 'main', inputs: { scheduled_run: 'true', scheduled_date: due } })
    });
    if (!dispatch.ok) return reply(502, { error: `Could not queue AUTOSEND (HTTP ${dispatch.status}).`, due });
    return reply(202, { queued: true, due });
  } catch (error) {
    console.error('DNU AUTOSEND recovery failed', error);
    return reply(502, { error: 'Could not reach the AUTOSEND service.' });
  }
});
