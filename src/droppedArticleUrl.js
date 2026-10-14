export function droppedArticleUrl(uriList, plainText) {
  for (const value of [uriList, plainText]) {
    const candidate = String(value || '').split(/\r?\n/).map(line => line.trim()).find(line => line && !line.startsWith('#'));
    try {
      const url = new URL(candidate);
      if (url.protocol === 'https:') return url.href;
    } catch { /* A dropped label is not an article URL. */ }
  }
  return '';
}
