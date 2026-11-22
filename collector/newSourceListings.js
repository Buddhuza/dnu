import { load } from 'cheerio';
import { listingCandidates_ } from './rules.js';

export const newSourceDomains = ['pap.pl', 'thedefensepost.com', 'therecord.media', 'defensescoop.com',
  'securityweek.com', 'middleeasteye.net', 'koreatimes.co.kr'];

export function shortlistNewSourcePages(candidates, limit = 150) {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const priority = newSourceDomains.flatMap(domain => sorted.filter(item => item.sourceDomain === domain).slice(0, 2));
  const prioritizedLinks = new Set(priority.map(item => item.link));
  return [...priority, ...sorted.filter(item => !prioritizedLinks.has(item.link))].slice(0, limit);
}

// Some publisher listings put the headline beside an empty link, or include a
// long teaser inside that link. Supply the headline and date explicitly to the
// existing candidate parser so it can apply the normal geography and scoring.
export function newSourceListingCandidates(html, feed, window, registry) {
  const $ = load(html);
  const nodes = [];
  if (feed.domain === 'pap.pl') {
    $('a.newsLink[href^="/en/news/"]').each((_, element) => {
      const card = $(element).parent();
      const headline = card.find('h2.title').first().text().replace(/\s+/g, ' ').trim();
      const datePublished = card.find('time[datetime]').first().attr('datetime') || '';
      const description = card.find('.field--name-field-lead').first().text().replace(/\s+/g, ' ').trim();
      if (headline) nodes.push({ '@type': 'NewsArticle', headline,
        url: new URL($(element).attr('href'), feed.url).href, datePublished, description });
    });
  } else if (feed.domain === 'koreatimes.co.kr') {
    $('a[href*="/southkorea/"], a[href*="/foreignaffairs/northkorea/"]').each((_, element) => {
      const anchor = $(element);
      const headline = anchor.find('h2').first().text().replace(/\s+/g, ' ').trim();
      const description = anchor.find('p').first().text().replace(/\s+/g, ' ').trim();
      if (headline) nodes.push({ '@type': 'NewsArticle', headline,
        url: new URL(anchor.attr('href'), feed.url).href, description });
    });
  } else if (feed.domain === 'therecord.media') {
    $('a[href] h2').each((_, element) => {
      const anchor = $(element).closest('a[href]');
      const href = anchor.attr('href') || '';
      const headline = $(element).text().replace(/\s+/g, ' ').trim();
      if (href.startsWith('/') && !href.startsWith('/news/') && headline)
        nodes.push({ '@type': 'NewsArticle', headline, url: new URL(href, feed.url).href });
    });
  }
  if (!nodes.length) return listingCandidates_(html, feed, window, registry);
  return listingCandidates_(`<script type="application/ld+json">${JSON.stringify(nodes)}</script>`, feed, window, registry);
}
