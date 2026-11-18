const viennaClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});

export function isScheduledGmailCandidate(cron, now = new Date()) {
  const match = String(cron).match(/^30\s+(19|20)\s+\*\s+\*\s+\*$/);
  if (!match || !Number.isFinite(now.getTime())) return false;
  const scheduled = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), Number(match[1]), 30));
  if (scheduled > now) scheduled.setUTCDate(scheduled.getUTCDate() - 1);
  return viennaClock.format(scheduled) === '21:30';
}
