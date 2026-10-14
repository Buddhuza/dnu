const dateParts = iso => Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Vienna', day: 'numeric', month: 'long', year: 'numeric'
}).formatToParts(new Date(iso)).map(part => [part.type, part.value]));

export function reportDateLabel(windowStart, windowEnd) {
  if (!Number.isFinite(Date.parse(windowStart)) || !Number.isFinite(Date.parse(windowEnd))) return '';
  const start = dateParts(windowStart);
  const end = dateParts(windowEnd);
  if (start.day === end.day && start.month === end.month && start.year === end.year) return `${start.day} ${start.month} ${start.year}`;
  if (start.month === end.month && start.year === end.year) return `${start.day}–${end.day} ${end.month} ${end.year}`;
  if (start.year === end.year) return `${start.day} ${start.month} – ${end.day} ${end.month} ${end.year}`;
  return `${start.day} ${start.month} ${start.year} – ${end.day} ${end.month} ${end.year}`;
}

export function reportEndDateLabel(windowEnd) {
  if (!Number.isFinite(Date.parse(windowEnd))) return '';
  const end = dateParts(windowEnd);
  return `${end.day} ${end.month} ${end.year}`;
}
