import { articleJson } from './articleTranslation.js';
import { verifiedTranslatedBody } from './translatedBody.js';

const tidy = value => String(value || '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();

export function extractReutersBody(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const start = lines.findIndex(line => /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s*\(Reuters\)\s*-/i.test(line));
  if (start < 0) return '';
  const body = [];
  for (const line of lines.slice(start)) {
    if (/^(?:Reporting by|Writing by|Editing by|Our Standards:|## (?:Read Next|More from Reuters))/i.test(line.trim())) break;
    if (/^(?:Advertisement|The Misinformation Monitor newsletter|Sign up for our newsletter|!\[)/i.test(line.trim())) continue;
    const value = line.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`]+/g, '').trim();
    if (value.length > 35 && !/^\[|^#/.test(value)) body.push(value);
  }
  return body.join(' ').split(/\s+/).length >= 40 ? body.join('\n\n') : '';
}

export function extractMarkdownBody(markdown, headline = '') {
  const lines = String(markdown || '').replace(/\r/g, '').split('\n');
  const clean = line => tidy(line.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`]+/g, ''));
  const target = tidy(headline).toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ');
  let start = lines.findIndex(line => clean(line).toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ') === target);
  if (start < 0) start = lines.findIndex(line => /^#\s+/.test(line));
  if (start < 0) start = 0;
  const paragraphs = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,3}\s*(?:Related|More (?:stories|news)|Latest (?:news|stories)|Recommended|Read more|Up next|Newsletter|About (?:us|the author)|Popular|Comments|Share this article)\b/i.test(line) && paragraphs.length) break;
    if (/^\s*(?:Advertisement|Subscribe|Sign up|Log in|Copyright|©|\(c\) \d{4}|All rights reserved|Follow us|Read more:|Photo:|Image:|Share|Updated:|Published:)\b/i.test(line)) continue;
    if (/^\s*(?:!\[|\[!\[|\| |[-*] \[|\[.{1,80}\]\(https?:)/.test(line)) continue;
    const value = clean(line.replace(/^#{1,6}\s+/, ''));
    if (value.length < 35 || /^https?:\/\//.test(value)) continue;
    if (/^(?:More on this|Read also|See also|Join our|Click here|Our coverage|This article was|You can read|Get the latest)\b/i.test(value)) continue;
    paragraphs.push(value);
  }
  return paragraphs.join('\n\n');
}

export function extractBrowserArticleBody(page, headline = '') {
  const extracted = articleJson(page);
  if (extracted.translatedHeadline) return verifiedTranslatedBody(extracted.translatedBody);
  if (/reuters\.com/i.test(page?.metadata?.sourceURL || page?.metadata?.url || '')) {
    const body = extractReutersBody(page.markdown);
    if (body) return body;
  }
  if (page?.html && typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(page.html, 'text/html');
    const belta = String(doc.querySelector('.js-mediator-article')?.textContent || '').replace(/\s*Follow us on:.*$/s, '').replace(/\s+/g, ' ').trim();
    if (belta.split(/\s+/).length >= 40) return belta;
    if (doc.querySelector('.article-body__content--subscriber-gated') && doc.querySelectorAll('.article-body__content--subscriber-gated p').length <= 1) return '';
    doc.querySelectorAll('script,style,nav,aside,footer,form,figure,figcaption,button,[aria-hidden="true"],.ad,.advertisement,.related,.recommended,.newsletter,.social-share,[class*="gate-body"],[class*="paywall"],[class*="subscription"]').forEach(element => element.remove());
    const selectors = '[itemprop="articleBody"], #detailContent, .news__info, .content-narrow, .news-body, .article-text-details, .entry-content, [class*="article-body"], [class*="article__body"], [class*="story-body"], [class*="story__body"], [class*="post-content"], article, main';
    const headlineWords = [...new Set(String(headline).toLowerCase().match(/[a-z]{5,}/g) || [])];
    const candidates = [...doc.querySelectorAll(selectors)].map(element => {
      const paragraphs = [...element.querySelectorAll('p')].map(p => p.textContent.replace(/\s+/g, ' ').trim()).filter(text => text.length >= 35 && !/^(?:Advertisement|Subscribe|Read more|See also|Copyright|Photo:)/i.test(text));
      const words = paragraphs.join(' ').split(/\s+/).length;
      const className = element.className && typeof element.className === 'string' ? element.className : '';
      const specificity = /article.body|article__body|story.body|post.content|news.body|article.text.details|news__info|content.narrow|entry.content/i.test(className) || element.id === 'detailContent' || element.getAttribute('itemprop') === 'articleBody' ? 1000 : element.tagName === 'ARTICLE' ? 600 : 0;
      const opening = paragraphs.slice(0, 2).join(' ').toLowerCase();
      const relevance = headlineWords.length ? 800 * headlineWords.filter(word => opening.includes(word)).length / headlineWords.length : 0;
      return { paragraphs, score: Math.min(words, 500) + specificity + relevance - (/card|thumbnail|widget|recommend/i.test(className) ? 1000 : 0) - Math.max(0, words - 1000) / 10, words };
    }).filter(item => item.words >= 40).sort((a, b) => b.score - a.score);
    if (candidates[0]) {
      if (/subscriber-gated|paywall/i.test(page.html) && candidates[0].paragraphs.length === 1) return '';
      return candidates[0].paragraphs.join('\n\n');
    }
  }
  return extractMarkdownBody(page?.markdown, headline);
}
