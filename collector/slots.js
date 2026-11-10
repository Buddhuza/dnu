const viennaParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', hourCycle: 'h23'
});

export function dueCollectionSlot(now = new Date()) {
  const parts = Object.fromEntries(viennaParts.formatToParts(now).map(part => [part.type, part.value]));
  const hour = Number(parts.hour);
  if (hour < 1) return null;
  const slot = hour < 13 ? '01' : '13';
  return `${parts.year}-${parts.month}-${parts.day}T${slot}:00 Europe/Vienna`;
}

export function isScheduledCollectionHour(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Vienna', hour: '2-digit', hourCycle: 'h23'
  }).format(now));
  return hour === 1 || hour === 13;
}

export function isScheduledUtcCandidate(cron, now = new Date()) {
  const hour = Number(String(cron).match(/^0\s+(\d{1,2})\s+\*\s+\*\s+\*$/)?.[1]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return false;
  const scheduled = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour));
  if (scheduled > now) scheduled.setUTCDate(scheduled.getUTCDate() - 1);
  return isScheduledCollectionHour(scheduled);
}
