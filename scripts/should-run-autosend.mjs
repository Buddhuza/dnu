import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dueAutosendDate } from './autosend-schedule.js';

export function scheduledAutosendDecision({ eventName, scheduledRun = false, requestedDate = '', now = new Date(), history = {}, holidays = [] }) {
  if (eventName !== 'schedule' && !scheduledRun) return { run: true, date: '' };
  const date = dueAutosendDate(now, history, holidays);
  return { run: Boolean(date && (!requestedDate || requestedDate === date)), date };
}

if (process.argv[1]?.endsWith('/should-run-autosend.mjs')) {
  try {
    const scheduled = process.env.GITHUB_EVENT_NAME === 'schedule' || process.env.SCHEDULED_RUN === 'true';
    let history = {};
    if (scheduled) {
      try { history = JSON.parse(execFileSync('git', ['show', 'origin/autosend-status:history.json'], { encoding: 'utf8' })); }
      catch { /* Older status branches have no history yet. */ }
    }
    const holidays = JSON.parse(readFileSync(new URL('../data/autosend-holidays.json', import.meta.url), 'utf8'));
    const result = scheduledAutosendDecision({ eventName: process.env.GITHUB_EVENT_NAME, scheduledRun: process.env.SCHEDULED_RUN === 'true',
      requestedDate: process.env.SCHEDULED_DATE || '', history, holidays });
    console.log(`run=${result.run}\nscheduled_date=${result.date}`);
    console.error(result.run ? `AUTOSEND due for ${result.date || 'manual request'}` : 'No unsent AUTOSEND date is due.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
