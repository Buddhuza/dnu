// Vienna calendar dates are used throughout; GitHub and Supabase clocks are UTC.
export const AUTOSEND_START_DATE = '2026-11-20';
export const AUTOSEND_TEST_DATE = '2026-11-20';
export const AUTOSEND_TEST_TIME = '22:15';

export function viennaParts(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now).map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export function isAutosendDate(date, holidays = []) {
  if (date === AUTOSEND_TEST_DATE) return true;
  if (holidays.includes(date)) return true;
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6;
}

export function dueAutosendDate(now = new Date(), completed = {}, holidays = []) {
  const current = viennaParts(now);
  for (let day = new Date(`${AUTOSEND_START_DATE}T12:00:00Z`); day.toISOString().slice(0, 10) <= current.date; day.setUTCDate(day.getUTCDate() + 1)) {
    const date = day.toISOString().slice(0, 10);
    // The one-time test must never block a later weekend edition.
    if (date === AUTOSEND_TEST_DATE && date !== current.date) continue;
    if (!isAutosendDate(date, holidays) || completed[date] === 'email_submitted') continue;
    if (date === current.date && current.time < (date === AUTOSEND_TEST_DATE ? AUTOSEND_TEST_TIME : '08:00')) continue;
    return date;
  }
  return '';
}
