export function excludedHeadlineReason(value) {
  const headline = String(value || '').trim();
  if (headline.includes('?')) return 'Question headlines are excluded';
  if (/^(?:analysis|opinion)\b/i.test(headline)) return 'Analysis and opinion headlines are excluded';
  return '';
}
