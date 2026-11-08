export function cleanHeadlinePrefix(value) {
  return String(value ?? '').trim()
    .replace(/^(\(文A\)\s*)?EXCLUSIVE\s*:(?:\s|&nbsp;|&#160;|&#x0*a0;)*/i, '$1')
    .replace(/^((?:\(文A\)\s*)?)[\p{Extended_Pictographic}\u2190-\u2bff\ufe0f\u200d\s]+/u, '$1')
    .replace(/[\p{Extended_Pictographic}\u2190-\u2bff\ufe0f\u200d\s]+$/u, '')
    .trim();
}
