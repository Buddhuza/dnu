export function reportFilename({ windowStart, windowEnd } = {}) {
  if (!windowStart || !windowEnd || !Number.isFinite(Date.parse(windowStart)) || !Number.isFinite(Date.parse(windowEnd))) return 'Daily news update.docx';
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  const stamp = iso => {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(iso)).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}-${parts.minute}`;
  };
  return `Daily news update - ${stamp(windowStart)} to ${stamp(windowEnd)}.docx`;
}
