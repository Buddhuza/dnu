function canonicalUrl(value) {
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) if (/^utm_|^(?:fbclid|gclid|mc_cid|mc_eid)$/i.test(key)) url.searchParams.delete(key);
    return `${url.hostname.replace(/^www\./, '').toLowerCase()}${url.pathname.replace(/\/$/, '')}${url.search}`;
  } catch { return ''; }
}

function headlineKey(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function previousCoverageIndex(articles) {
  return {
    urls: new Set(articles.map(article => canonicalUrl(article.url)).filter(Boolean)),
    headlines: new Set(articles.map(article => headlineKey(article.title)).filter(Boolean))
  };
}

export function previousCoverageReason(article, index) {
  const url = canonicalUrl(article.url);
  if (url && index.urls.has(url)) return 'same URL';
  const title = headlineKey(article.title);
  return title && index.headlines.has(title) ? 'same headline' : null;
}
