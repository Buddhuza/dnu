export function wallTimeToIso(timeZone, year, month, day, hour = 12, minute = 0, second = 0) {
  const target = Date.UTC(year, month - 1, day, hour, minute, second);
  if (!Number.isFinite(target) || new Date(target).getUTCMonth() !== month - 1 || new Date(target).getUTCDate() !== day) return null;
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  } catch { return null; }
  let instant = target;
  for (let pass = 0; pass < 4; pass++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
    const shown = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    const difference = target - shown;
    if (difference === 0) return new Date(instant).toISOString();
    instant += difference;
  }
  return new Date(instant).toISOString();
}

export const viennaWallTimeToIso = (year, month, day, hour = 12, minute = 0, second = 0) => wallTimeToIso('Europe/Vienna', year, month, day, hour, minute, second);

export function formatViennaDateTime(value) {
  if (!Number.isFinite(Date.parse(value))) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Vienna', year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short'
  }).format(new Date(value));
}

export function formatViennaCompactDateTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Vienna', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`;
}
