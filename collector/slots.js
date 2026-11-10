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
