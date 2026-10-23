import JSZip from 'jszip';
import { reportEndDateLabel } from './reportDate.js';
import { reportStoryText } from './reportText.js';
import { disclaimerFirst, disclaimerSecond } from './disclaimer.js';
import { displaySourceName } from './sourceNames.js';
import { reportHeadingLabel } from './reportLabels.js';

const escapeXml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
const textRun = (value, properties = '') => `<w:r><w:rPr>${properties}</w:rPr><w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r>`;
const calibri = '<w:rFonts w:eastAsia="Calibri" w:cs="Calibri"/>';

function sectionParagraph(value, headlineOnly = false) {
  return `<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:keepNext/><w:spacing w:before="${headlineOnly ? 240 : 360}" w:after="${headlineOnly ? 80 : 120}"/><w:rPr><w:b/><w:bCs/></w:rPr></w:pPr>${textRun(value.toUpperCase(), `${calibri}<w:b/><w:bCs/>`)}</w:p>`;
}

function subsectionParagraph(value, plainTopic = false, headlineOnly = false) {
  return `<w:p><w:pPr><w:keepNext/>${plainTopic ? '' : '<w:shd w:val="clear" w:color="auto" w:fill="D9E2F3"/>'}<w:spacing w:before="${headlineOnly ? 130 : 200}" w:after="${headlineOnly ? 70 : 120}"/><w:jc w:val="both"/></w:pPr>${textRun(value.toUpperCase(), `${calibri}<w:b/><w:color w:val="0070C0"/><w:sz w:val="24"/>`)}</w:p>`;
}

function storyParagraph(item, relationshipId, headlineOnly = false) {
  const { headline, summary } = reportStoryText(item);
  const detail = !headlineOnly && summary ? textRun(` ${summary}`, `${calibri}<w:sz w:val="24"/>`) : '';
  return `<w:p><w:pPr><w:spacing w:after="${headlineOnly ? 60 : 160}"${headlineOnly ? ' w:line="260" w:lineRule="auto"' : ''}/><w:jc w:val="both"/></w:pPr>${textRun(headline, `${calibri}<w:b/><w:sz w:val="24"/>`)}${detail}${textRun(' (', `${calibri}<w:sz w:val="24"/>`)}<w:hyperlink r:id="${relationshipId}">${textRun(displaySourceName(item.sourceName), '<w:color w:val="0563C1"/><w:sz w:val="24"/><w:u w:val="single"/>')}</w:hyperlink>${textRun(')', `${calibri}<w:sz w:val="24"/>`)}</w:p>`;
}

function reportDateParagraph(value) {
  return `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="80" w:after="180"/></w:pPr>${textRun(value, `${calibri}<w:sz w:val="24"/>`)}</w:p>`;
}

function disclaimerParagraphs() {
  const style = `${calibri}<w:sz w:val="18"/>`;
  const first = `<w:p><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="100" w:after="120"/><w:jc w:val="both"/></w:pPr>${textRun('Disclaimer:', `${style}<w:b/>`)}${textRun(` ${disclaimerFirst}`, style)}</w:p>`;
  const second = `<w:p><w:pPr><w:keepLines/><w:spacing w:after="0"/><w:jc w:val="both"/></w:pPr>${textRun(disclaimerSecond, style)}</w:p>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="9638" w:type="dxa"/><w:tblpPr w:horzAnchor="margin" w:vertAnchor="margin" w:tblpXSpec="center" w:tblpYSpec="bottom" w:leftFromText="0" w:rightFromText="0" w:topFromText="0" w:bottomFromText="0"/><w:tblBorders><w:top w:val="single" w:sz="6" w:color="808080"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="9638"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr><w:tc><w:tcPr><w:tcW w:w="9638" w:type="dxa"/></w:tcPr>${first}${second}</w:tc></w:tr></w:tbl>`;
}

const defaultTitle = () => 'DAILY NEWS UPDATE';

export async function createReportDocxFromTemplate(templateBytes, { title, windowStart, windowEnd, compiledAt, articles, headlineOnly = false }) {
  const zip = await JSZip.loadAsync(templateBytes);
  const paragraphs = [];
  const reportDate = reportEndDateLabel(compiledAt || windowEnd);
  if (reportDate) paragraphs.push(reportDateParagraph(reportDate));
  const relationships = [];
  let currentSection = '', currentSubsection = '', currentCountry = '';
  for (const [index, item] of articles.entries()) {
    const section = item.section || 'Miscellaneous';
    if (section !== currentSection) {
      currentSection = section;
      currentSubsection = '';
      currentCountry = '';
      paragraphs.push(sectionParagraph(section, headlineOnly));
    }
    if (item.subsection && item.subsection !== currentSubsection) {
      currentSubsection = item.subsection;
      currentCountry = '';
      paragraphs.push(subsectionParagraph(reportHeadingLabel(item.subsection), section === 'Miscellaneous', headlineOnly));
    }
    if (item.country && item.country !== currentCountry) {
      currentCountry = item.country;
      paragraphs.push(subsectionParagraph(reportHeadingLabel(item.country), false, headlineOnly));
    }
    const relationshipId = `rIdStory${index + 1}`;
    paragraphs.push(storyParagraph(item, relationshipId, headlineOnly));
    relationships.push(`<Relationship Id="${relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXml(item.url)}" TargetMode="External"/>`);
  }
  paragraphs.push(disclaimerParagraphs());
  let documentXml = await zip.file('word/document.xml').async('string');
  documentXml = documentXml.replace(/Organization for Security and Co-operation in Europe/g, 'Organisation for Security and Co-operation in Europe');
  documentXml = documentXml.replace('{{TITLE}}', escapeXml(title?.trim() || defaultTitle()));
  documentXml = documentXml.replace(/<w:sectPr\b/, `${paragraphs.join('')}<w:sectPr`);
  zip.file('word/document.xml', documentXml);
  let relationshipXml = await zip.file('word/_rels/document.xml.rels').async('string');
  relationshipXml = relationshipXml.replace('</Relationships>', `${relationships.join('')}</Relationships>`);
  zip.file('word/_rels/document.xml.rels', relationshipXml);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
