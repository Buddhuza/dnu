export function cleanHeadlinePrefix(value) {
  return String(value ?? '').trim()
    .replace(/^(\(文A\)\s*)?EXCLUSIVE\s*:(?:\s|&nbsp;|&#160;|&#x0*a0;)*/i, '$1')
    .trim();
}
