const viennaParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});

const maxGithubDelayMs = 12 * 60 * 60_000;

function viennaSlot(date) {
  const parts = Object.fromEntries(viennaParts.formatToParts(date).map(part => [part.type, part.value]));
  return [1, 13].includes(Number(parts.hour)) ? `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:00 Europe/Vienna` : null;
}

function candidateTime(cron, now) {
  const hour = Number(String(cron).match(/^0\s+(\d{1,2})\s+\*\s+\*\s+\*$/)?.[1]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  const scheduled = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour));
  if (scheduled > now) scheduled.setUTCDate(scheduled.getUTCDate() - 1);
  return scheduled;
}

export function mostRecentViennaSlot(now = new Date()) {
  const parts = Object.fromEntries(viennaParts.formatToParts(now).map(part => [part.type, part.value]));
  const hour = Number(parts.hour);
  if (hour >= 13) return `${parts.year}-${parts.month}-${parts.day}T13:00 Europe/Vienna`;
  if (hour >= 1) return `${parts.year}-${parts.month}-${parts.day}T01:00 Europe/Vienna`;
  const prior = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) - 1));
  return `${prior.toISOString().slice(0, 10)}T13:00 Europe/Vienna`;
}

export function scheduledSlotForCron(cron, now = new Date()) {
  const scheduled = candidateTime(cron, now);
  return scheduled && viennaSlot(scheduled);
}

export function collectionDecision(eventName, cron, previousSlot, now = new Date()) {
  if (eventName === 'workflow_dispatch') return { run: true, scheduledSlot: '', recordSkip: false };
  if (eventName === 'push') return { run: true, scheduledSlot: mostRecentViennaSlot(now), recordSkip: false };
  if (eventName !== 'schedule') return { run: false, scheduledSlot: '', recordSkip: false };
  const slot = cron === '15 * * * *' ? mostRecentViennaSlot(now) : scheduledSlotForCron(cron, now);
  if (!slot || slot === previousSlot) return { run: false, scheduledSlot: '', recordSkip: false };
  if (cron !== '15 * * * *' && !isScheduledUtcCandidate(cron, now))
    return { run: false, scheduledSlot: slot, recordSkip: isStaleScheduledUtcCandidate(cron, now) };
  return { run: true, scheduledSlot: slot, recordSkip: false };
}

export function dueCollectionSlot(now = new Date()) {
  const parts = Object.fromEntries(viennaParts.formatToParts(now).map(part => [part.type, part.value]));
  const hour = Number(parts.hour);
  if (![1, 13].includes(hour) || Number(parts.minute) >= 15) return null;
  const slot = parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${slot}:00 Europe/Vienna`;
}

export function isScheduledCollectionHour(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Vienna', hour: '2-digit', hourCycle: 'h23'
  }).format(now));
  return hour === 1 || hour === 13;
}

export function isScheduledUtcCandidate(cron, now = new Date()) {
  const scheduled = candidateTime(cron, now);
  if (!scheduled) return false;
  return isScheduledCollectionHour(scheduled) && now >= scheduled && now - scheduled < maxGithubDelayMs;
}

export function isStaleScheduledUtcCandidate(cron, now = new Date()) {
  const scheduled = candidateTime(cron, now);
  if (!scheduled) return false;
  return isScheduledCollectionHour(scheduled) && now - scheduled >= maxGithubDelayMs;
}
