export function grabArticleUrl(value, sourceUrl) {
  const candidate = String(value || '').split(/\r?\n/).map(line => line.trim()).find(line => line && !line.startsWith('#'));
  try {
    const article = new URL(candidate);
    const source = new URL(sourceUrl);
    if (article.protocol !== 'https:') return '';
    const articleHost = article.hostname.replace(/^www\./, '');
    const sourceHost = source.hostname.replace(/^www\./, '');
    if (articleHost !== sourceHost && !articleHost.endsWith(`.${sourceHost}`) && !sourceHost.endsWith(`.${articleHost}`)) return '';
    if (article.origin === source.origin && article.pathname.replace(/\/$/, '') === source.pathname.replace(/\/$/, '') && !article.search) return '';
    return article.href;
  } catch { return ''; }
}
