import sax from 'sax';

// Explicit publisher feeds. A failed or unusable feed falls back to Firecrawl.
export const FEED_URLS = {
  'source-2': 'https://balkaninsight.com/feed/',
  'source-36': 'https://www.pravda.com.ua/eng/rss/',
  'source-61': 'https://civil.ge/feed/',
  'source-65': 'https://oc-media.org/feed/',
  'source-79': 'https://www.rferl.org/api/zy-pqye',
  'source-80': 'https://rss.dw.com/rdf/rss-en-all',
  'source-81': 'https://www.politico.eu/feed/',
  'source-82': 'https://www.euronews.com/rss?level=theme&name=news',
  'source-83': 'https://feeds.bbci.co.uk/news/world/rss.xml',
  'source-89': 'https://english.radio.cz/rss',
  'source-101': 'https://rss.cnn.com/rss/edition_world.rss',
  'source-106': 'https://www.theguardian.com/world/rss',
  'source-115': 'https://www.themoscowtimes.com/rss/news',
  'source-122': 'https://www.aljazeera.com/xml/rss/all.xml',
  'source-154': 'https://feeds.npr.org/1004/rss.xml',
  'source-155': 'https://www.pbs.org/newshour/feeds/rss/world',
  'source-158': 'https://thehill.com/feed/',
  'source-165': 'https://www.voanews.com/api/zy-pqye'
};

export function parseFeed(xml) {
  const parser = sax.parser(true, { trim: true });
  const articles = [];
  let item = null;
  let field = '';
  let text = '';
  parser.onopentag = node => {
    const name = node.name.toLowerCase();
    if (name === 'item' || name === 'entry') item = { title: '', url: '', publishedAt: '' };
    if (!item) return;
    field = name;
    text = '';
    if (name === 'link' && node.attributes.href) item.url = String(node.attributes.href);
  };
  parser.ontext = value => { text += value; };
  parser.oncdata = value => { text += value; };
  parser.onclosetag = rawName => {
    const name = rawName.toLowerCase();
    if (!item) return;
    if (name === field) {
      const value = text.trim();
      if (name === 'title') item.title = value;
      if (name === 'link' && value && !item.url) item.url = value;
      if (['pubdate', 'published', 'updated', 'dc:date'].includes(name)) item.publishedAt = value;
      field = '';
      text = '';
    }
    if (name === 'item' || name === 'entry') {
      if (item.title && item.url && item.publishedAt && /(?:\d{1,2}:\d{2}|T\d{2}:\d{2})/.test(item.publishedAt) && /(?:Z|GMT|UTC|[+-]\d{2}:?\d{2})$/i.test(item.publishedAt)) {
        const timestamp = Date.parse(item.publishedAt);
        if (Number.isFinite(timestamp)) articles.push({ title: item.title, url: item.url, publishedAt: new Date(timestamp).toISOString() });
      }
      item = null;
    }
  };
  parser.write(xml).close();
  return articles;
}

export async function collectFeed(source, fetchImpl = fetch, feedUrl = FEED_URLS[source.id]) {
  const url = feedUrl;
  if (!url) return null;
  const response = await fetchImpl(url, { headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Feed returned HTTP ${response.status}`);
  const xml = await response.text();
  if (!/<(?:rss|rdf:RDF|feed)\b/i.test(xml.slice(0, 2000))) throw new Error('Feed did not return RSS or Atom XML');
  const articles = parseFeed(xml);
  if (!articles.length) throw new Error('Feed contained no timestamped articles');
  return { data: { json: { articles } }, collectionMethod: 'feed' };
}

export async function collectFallbackFeed(source, fetchImpl = fetch, accept = () => true) {
  const origin = new URL(source.url).origin;
  const candidates = [`${origin}/feed/`, `${origin}/rss.xml`];
  const results = await Promise.allSettled(candidates.map(async url => ({ ...(await collectFeed(source, fetchImpl, url)), feedUrl: url })));
  return results.find(result => result.status === 'fulfilled' && accept(result.value))?.value ?? null;
}
