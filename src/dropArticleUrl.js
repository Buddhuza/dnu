export function droppedArticleUrl(dataTransfer) {
  for (const type of ['text/uri-list', 'text/plain']) {
    const lines = (dataTransfer?.getData(type) || '').split(/\r?\n/);
    for (const line of lines) {
      const candidate = line.trim();
      if (!candidate || candidate.startsWith('#')) continue;
      try {
        const url = new URL(candidate);
        if (url.protocol === 'https:') return url.href;
      } catch { /* A dragged headline is not an article link. */ }
    }
  }
  return '';
}
