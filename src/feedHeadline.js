export function stripFeedTeaser(value) {
  const headline = String(value || '').trim();
  if (!/\b\d+\s+(?:minutes?|mins?|hours?|hrs?|days?)\s+ago\b/i.test(headline)) return headline;
  return headline.replace(/\s+\d+\s+(?:minutes?|mins?|hours?|hrs?|days?)\s+ago(?:\s+[A-Z]{2,})?$/i, '')
    .replace(/\s+(?:The|A|An)\s+(?:prime minister|president|minister|government|leader|spokesperson)\s+(?:made|said|announced|confirmed|told)\b.*$/i, '')
    .trim();
}
