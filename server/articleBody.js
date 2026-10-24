import { load } from 'cheerio';
import { extractMarkdownBody, extractReutersBody } from '../src/articleBodyText.js';
import { articleJson } from '../src/articleTranslation.js';

export function extractArticleBody(page, headline = '') {
  const extracted = articleJson(page);
  if (extracted.translatedHeadline) return String(extracted.translatedBody || '').trim();
  const html = String(page?.html || '');
  if (/reuters\.com/i.test(page?.metadata?.sourceURL || page?.metadata?.url || '')) {
    const body = extractReutersBody(page?.markdown);
    if (body) return body;
  }
  if (html) {
    const $ = load(html);
    const belta = $('.js-mediator-article').first().text().replace(/\s*Follow us on:.*$/s, '').replace(/\s+/g, ' ').trim();
    if (belta.split(/\s+/).length >= 40) return belta;
    if ($('.article-body__content--subscriber-gated').length && $('.article-body__content--subscriber-gated p').length <= 1) return '';
    $('script,style,nav,aside,footer,form,figure,figcaption,button,[aria-hidden="true"],.ad,.advertisement,.related,.recommended,.newsletter,.social-share,[class*="gate-body"],[class*="paywall"],[class*="subscription"]').remove();
    const selectors = '[itemprop="articleBody"], #detailContent, .news__info, .content-narrow, .news-body, .article-text-details, .entry-content, [class*="article-body"], [class*="article__body"], [class*="story-body"], [class*="story__body"], [class*="post-content"], article, main';
    const headlineWords = [...new Set(String(headline).toLowerCase().match(/[a-z]{5,}/g) || [])];
    const candidates = $(selectors).toArray().map(node => {
      const element = $(node);
      const paragraphs = element.find('p').toArray().map(p => $(p).text().replace(/\s+/g, ' ').trim()).filter(text => text.length >= 35 && !/^(?:Advertisement|Subscribe|Read more|See also|Copyright|Photo:)/i.test(text));
      const words = paragraphs.join(' ').split(/\s+/).length;
      const className = String(element.attr('class') || '');
      const specificity = /article.body|article__body|story.body|post.content|news.body|article.text.details|news__info|content.narrow|entry.content/i.test(className) || element.attr('itemprop') === 'articleBody' || element.attr('id') === 'detailContent' ? 1000 : node.tagName === 'article' ? 600 : 0;
      const opening = paragraphs.slice(0, 2).join(' ').toLowerCase();
      const relevance = headlineWords.length ? 800 * headlineWords.filter(word => opening.includes(word)).length / headlineWords.length : 0;
      const score = Math.min(words, 500) + specificity + relevance - (/card|thumbnail|widget|recommend/i.test(className) ? 1000 : 0) - Math.max(0, words - 1000) / 10;
      return { paragraphs, words, score };
    }).filter(candidate => candidate.words >= 40).sort((a, b) => b.score - a.score);
    if (candidates[0]) {
      if (/subscriber-gated|paywall/i.test(html) && candidates[0].paragraphs.length === 1) return '';
      return candidates[0].paragraphs.join('\n\n');
    }
  }
  return extractMarkdownBody(page?.markdown, headline);
}
