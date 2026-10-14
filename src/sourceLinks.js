export function articleLinksFromHtml(html, pageUrl, sourceUrl) {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const sourceHost = new URL(sourceUrl).hostname.replace(/^www\./, '');
  const seen = new Set();
  const links = [];
  for (const anchor of document.querySelectorAll('a[href]')) {
    let url;
    try { url = new URL(anchor.getAttribute('href'), pageUrl); } catch { continue; }
    const host = url.hostname.replace(/^www\./, '');
    if (url.protocol !== 'https:' || (host !== sourceHost && !host.endsWith(`.${sourceHost}`))) continue;
    url.hash = '';
    if (url.pathname === '/' || seen.has(url.href)) continue;
    const title = (anchor.textContent || anchor.querySelector('img')?.alt || '').replace(/\s+/g, ' ').trim();
    if (title.length < 18) continue;
    seen.add(url.href);
    links.push({ url: url.href, title });
    if (links.length === 80) break;
  }
  return links;
}
