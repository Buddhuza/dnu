import { reportEndDateLabel } from './reportDate.js';
import { reportStoryText } from './reportText.js';
import { disclaimerFirst, disclaimerSecond } from './disclaimer.js';
import { displaySourceName } from './sourceNames.js';
import { reportHeadingLabel } from './reportLabels.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export function emailSubject(compiledAt) {
  const date = reportEndDateLabel(compiledAt);
  return `OSCE SITROOM DAILY NEWS UPDATE, ${date.replace(/^(\d)\s/, '0$1 ')}`;
}

export function emailUpdateHtml({ title = 'DAILY NEWS UPDATE', compiledAt, articles, headlineOnly = false, logoUrl = '' }) {
  const logo = logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="OSCE" width="122" height="38" style="display:block;width:122px;height:38px;margin:0 auto 9pt">` : '';
  const paragraphs = [`<div style="font-family:Calibri,Arial,sans-serif;color:#000;max-width:640px;background:#fff"><div style="text-align:center">${logo}<p style="font-size:16pt;margin:0 0 2pt">Organisation for Security and Co-operation in Europe</p><p style="font-size:14pt;margin:0 0 2pt">Conflict Prevention Centre</p><p style="font-size:14pt;margin:0 0 2pt">Operations Service</p><p style="font-size:18pt;margin:0 0 13pt">Situation / Communications Room</p><h1 style="font-size:20pt;color:#000;margin:0 0 5pt">${escapeHtml(title)}</h1><p style="font-size:12pt;margin:0 0 14pt">${escapeHtml(reportEndDateLabel(compiledAt))}</p></div>`];
  let section = '', subsection = '', country = '';
  for (const article of articles) {
    const nextSection = article.section || 'Miscellaneous';
    if (nextSection !== section) {
      section = nextSection;
      subsection = '';
      country = '';
      paragraphs.push(`<h2 style="font-size:15pt;color:#0070c0;margin:${headlineOnly ? '10pt' : '16pt'} 0 5pt">${escapeHtml(section.toUpperCase())}</h2>`);
    }
    if (article.subsection && article.subsection !== subsection) {
      subsection = article.subsection;
      country = '';
      const highlight = section === 'Miscellaneous' ? '' : 'background-color:#d9e2f3;';
      paragraphs.push(`<h3 style="font-size:13pt;color:#0070c0;${highlight}margin:${headlineOnly ? '10pt' : '13pt'} 0 2pt;padding:2pt 3pt">${escapeHtml(reportHeadingLabel(subsection).toUpperCase())}</h3>`);
    }
    if (article.country && article.country !== country) {
      country = article.country;
      paragraphs.push(`<h4 style="font-size:13pt;color:#0070c0;background-color:#d9e2f3;margin:${headlineOnly ? '10pt' : '13pt'} 0 2pt;padding:2pt 3pt">${escapeHtml(reportHeadingLabel(country).toUpperCase())}</h4>`);
    }
    const { headline, summary } = reportStoryText(article);
    const detail = !headlineOnly && summary ? ` ${escapeHtml(summary)}` : '';
    paragraphs.push(`<p style="font-size:12pt;line-height:${headlineOnly ? '1.25' : '1.4'};margin:0 0 ${headlineOnly ? '3pt' : '8pt'}"><strong>${escapeHtml(headline)}</strong>${detail} (<a style="color:#0563c1;text-decoration:underline" href="${escapeHtml(article.url)}">${escapeHtml(displaySourceName(article.sourceName))}</a>)</p>`);
  }
  paragraphs.push(`<div style="border-top:1px solid #808080;margin-top:18pt;padding-top:7pt;font-size:9pt;line-height:1.35"><p style="margin:0 0 7pt"><strong>Disclaimer:</strong> ${escapeHtml(disclaimerFirst)}</p><p style="margin:0">${escapeHtml(disclaimerSecond)}</p></div></div>`);
  return paragraphs.join('');
}

export function emailUpdateText({ title = 'DAILY NEWS UPDATE', compiledAt, articles, headlineOnly = false }) {
  const lines = ['OSCE', 'Organisation for Security and Co-operation in Europe', 'Conflict Prevention Centre', 'Operations Service', 'Situation / Communications Room', '', title, reportEndDateLabel(compiledAt), ''];
  let section = '', subsection = '', country = '';
  for (const article of articles) {
    const nextSection = article.section || 'Miscellaneous';
    if (nextSection !== section) { section = nextSection; subsection = ''; country = ''; lines.push(section.toUpperCase()); }
    if (article.subsection && article.subsection !== subsection) { subsection = article.subsection; country = ''; lines.push(reportHeadingLabel(subsection).toUpperCase()); }
    if (article.country && article.country !== country) { country = article.country; lines.push(reportHeadingLabel(country).toUpperCase()); }
    const { headline, summary } = reportStoryText(article);
    lines.push(`${headline}${!headlineOnly && summary ? ` ${summary}` : ''} (${displaySourceName(article.sourceName)}: ${article.url})`, '');
  }
  lines.push(`Disclaimer: ${disclaimerFirst}`, '', disclaimerSecond);
  return lines.join('\n');
}
