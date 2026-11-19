const viennaClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});

export function scheduledGmailUtcDate(cron, now = new Date()) {
  const match = String(cron).match(/^(0|10|50)\s+(11|12|13)\s+\*\s+\*\s+\*$/);
  if (!match || !Number.isFinite(now.getTime())) return null;
  const scheduled = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), Number(match[2]), Number(match[1])));
  if (scheduled > now) scheduled.setUTCDate(scheduled.getUTCDate() - 1);
  return scheduled;
}

export function isScheduledGmailCandidate(cron, now = new Date()) {
  const scheduled = scheduledGmailUtcDate(cron, now);
  return scheduled !== null && ['13:50', '14:00', '14:10'].includes(viennaClock.format(scheduled));
}
