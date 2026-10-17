export function articleUrlFromQuery(search) {
  try {
    const url = new URL(new URLSearchParams(search).get('add'));
    return url.protocol === 'https:' ? url.href : '';
  } catch { return ''; }
}

export function articleBookmarklet(pageUrl) {
  const target = new URL(pageUrl);
  target.search = '';
  target.hash = '';
  return `javascript:(()=>{const u=${JSON.stringify(target.href)}+'?add='+encodeURIComponent(location.href);if(!window.open(u,'dnu_article_add'))location.href=u})()`;
}
