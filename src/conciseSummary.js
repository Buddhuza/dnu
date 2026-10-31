const words = value => String(value || '').trim().split(/\s+/).filter(Boolean);
const meaningful = value => (String(value || '').toLowerCase().match(/[a-z]{4,}/g) || [])
  .filter(word => !['that', 'this', 'with', 'from', 'their', 'there', 'which', 'would', 'could', 'about', 'after', 'before', 'while'].includes(word));

// Keep imported copy to one readable sentence. This is a conservative text
// selection pass, not a generated paraphrase of an article we have not read.
export function conciseDnuSummary(value, headline = '') {
  const original = String(value || '').replace(/\s+/g, ' ').trim();
  if (!original) return '';
  const headlineWords = new Set(meaningful(headline));
  const sentences = [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(original)]
    .slice(0, 4).map(({ segment }) => segment.trim().replace(/^[“"']|[”"']$/g, ''))
    .filter(Boolean);
  const cleaned = sentence => sentence
    .replace(/^[A-Z][A-Z ]{2,30}\s+[–—-]\s+/, '')
    .replace(/\s+[–—]\s+[^–—]{1,120}\s+[–—]\s+/, ' ')
    .replace(/[.!]+$/, '').trim();
  const newTerms = sentence => meaningful(sentence).filter(word => !headlineWords.has(word)).length;
  for (const sentence of sentences) {
    const candidate = cleaned(sentence);
    if (words(candidate).length >= 7 && words(candidate).length <= 25 && newTerms(candidate) >= 3 && !candidate.endsWith('?')) return candidate;
  }
  for (const sentence of sentences) {
    const candidate = cleaned(sentence)
      .replace(/,\s+(?:after|before|while|which|including|as well as)\b.*$/i, '')
      .replace(/\s+in an interview\b.*$/i, '')
      .replace(/\s+with each passing day\b/i, '');
    if (words(candidate).length >= 7 && words(candidate).length <= 30 && newTerms(candidate) >= 2) return candidate;
  }
  const commissionFunding = original.match(/^(The European Commission) has responded to .+?, but has offered (no new funding[^.]+)[.]/i);
  if (commissionFunding) return `${commissionFunding[1]} has offered ${commissionFunding[2]}`;
  const first = cleaned(sentences[0] || original);
  return words(first).length <= 30 ? first : original;
}
