import JSZip from 'jszip';

const escapeXml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
const textRun = (value, properties = '') => `<w:r><w:rPr>${properties}</w:rPr><w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r>`;
const calibri = '<w:rFonts w:eastAsia="Calibri" w:cs="Calibri"/>';

function sectionParagraph(value) {
  return `<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:keepNext/><w:spacing w:before="360" w:after="120"/><w:rPr><w:b/><w:bCs/></w:rPr></w:pPr>${textRun(value.toUpperCase(), `${calibri}<w:b/><w:bCs/>`)}</w:p>`;
}

function subsectionParagraph(value, plainTopic = false) {
  return `<w:p><w:pPr><w:keepNext/>${plainTopic ? '' : '<w:shd w:val="clear" w:color="auto" w:fill="D9E2F3"/>'}<w:spacing w:before="200" w:after="120"/><w:jc w:val="both"/></w:pPr>${textRun(value.toUpperCase(), `${calibri}<w:b/><w:color w:val="0070C0"/><w:sz w:val="24"/>`)}</w:p>`;
}

function storyParagraph(item, relationshipId) {
  return `<w:p><w:pPr><w:spacing w:after="160"/><w:jc w:val="both"/></w:pPr>${textRun(String(item.title ?? '').trim(), `${calibri}<w:b/><w:sz w:val="24"/>`)}${textRun(' (', `${calibri}<w:sz w:val="24"/>`)}<w:hyperlink r:id="${relationshipId}">${textRun(item.sourceName, '<w:color w:val="0563C1"/><w:sz w:val="24"/><w:u w:val="single"/>')}</w:hyperlink>${textRun(')', `${calibri}<w:sz w:val="24"/>`)}</w:p>`;
}

function noteParagraph(value) {
  return `<w:p><w:pPr><w:spacing w:after="120"/><w:jc w:val="both"/></w:pPr>${textRun(value, `${calibri}<w:color w:val="595959"/>`)}</w:p>`;
}

const disclaimerFirst = 'This product is based on open media sources only and the material used is not always fully validated. Items selected are abridged from the original or are "verbatim". All views, opinions and accounts contained herein are those of the original authors, and do not imply official endorsement or acceptance by the OSCE.';
const disclaimerSecond = 'We would like to remind all our recipients that SitRoom News Updates are for internal use only and is not intended for further dissemination or distribution. Thank you for your understanding and co-operation regarding this matter.';

function disclaimerParagraphs() {
  const style = `${calibri}<w:sz w:val="18"/>`;
  const first = `<w:p><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="100" w:after="120"/><w:jc w:val="both"/></w:pPr>${textRun('Disclaimer:', `${style}<w:b/>`)}${textRun(` ${disclaimerFirst}`, style)}</w:p>`;
  const second = `<w:p><w:pPr><w:keepLines/><w:spacing w:after="0"/><w:jc w:val="both"/></w:pPr>${textRun(disclaimerSecond, style)}</w:p>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="9638" w:type="dxa"/><w:tblpPr w:horzAnchor="margin" w:vertAnchor="margin" w:tblpXSpec="center" w:tblpYSpec="bottom" w:leftFromText="0" w:rightFromText="0" w:topFromText="0" w:bottomFromText="0"/><w:tblBorders><w:top w:val="single" w:sz="6" w:color="808080"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="9638"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr><w:tc><w:tcPr><w:tcW w:w="9638" w:type="dxa"/></w:tcPr>${first}${second}</w:tc></w:tr></w:tbl>`;
}

function sourceListParagraphs(items) {
  const groups = new Map();
  for (const item of items) {
    const group = item.group || 'Other';
    if (!groups.has(group)) groups.set(group, []);
    let host = '';
    try { host = new URL(item.url).hostname.replace(/^www\./, ''); } catch { /* Session-only outcomes may have no URL. */ }
    groups.get(group).push(host ? `${item.name} (${host})` : item.name);
  }
  return [...groups].map(([group, names]) => noteParagraph(`${group.toUpperCase()}: ${names.join('; ')}.`));
}

const defaultTitle = () => `DAILY NEWS UPDATE, ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Vienna' }).format(new Date())}`;

export async function createReportDocxFromTemplate(templateBytes, { title, articles, sourceOutcomes = [] }) {
  const zip = await JSZip.loadAsync(templateBytes);
  const paragraphs = [];
  const relationships = [];
  let currentSection = '', currentSubsection = '', currentCountry = '';
  for (const [index, item] of articles.entries()) {
    const section = item.section || 'Miscellaneous';
    if (section !== currentSection) {
      currentSection = section;
      currentSubsection = '';
      currentCountry = '';
      paragraphs.push(sectionParagraph(section));
    }
    if (item.subsection && item.subsection !== currentSubsection) {
      currentSubsection = item.subsection;
      currentCountry = '';
      paragraphs.push(subsectionParagraph(item.subsection, section === 'Miscellaneous'));
    }
    if (item.country && item.country !== currentCountry) {
      currentCountry = item.country;
      paragraphs.push(subsectionParagraph(item.country));
    }
    const relationshipId = `rIdStory${index + 1}`;
    paragraphs.push(storyParagraph(item, relationshipId));
    relationships.push(`<Relationship Id="${relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXml(item.url)}" TargetMode="External"/>`);
  }
  const blocked = sourceOutcomes.filter(item => /failed|unreadable|could not be fetched/i.test(item.status));
  const unselected = sourceOutcomes.filter(item => item.status !== 'collected' && !/failed|unreadable|could not be fetched/i.test(item.status));
  if (blocked.length || unselected.length) {
    paragraphs.push(noteParagraph('AGENCIES FROM WHICH NO QUALIFYING ARTICLE WAS COLLECTED'));
    paragraphs.push(noteParagraph('The lists below distinguish retrieval failures from sources whose articles were not fully reviewed. A fetched page without a selected story may still have relevant news.'));
    if (blocked.length) {
      paragraphs.push(noteParagraph('Access failed or page unreadable'));
      paragraphs.push(...sourceListParagraphs(blocked));
    }
    if (unselected.length) {
      paragraphs.push(noteParagraph('No article selected in this roundup'));
      paragraphs.push(...sourceListParagraphs(unselected));
    }
  }
  paragraphs.push(disclaimerParagraphs());
  let documentXml = await zip.file('word/document.xml').async('string');
  documentXml = documentXml.replace('{{TITLE}}', escapeXml(title?.trim() || defaultTitle()));
  documentXml = documentXml.replace(/<w:sectPr\b/, `${paragraphs.join('')}<w:sectPr`);
  zip.file('word/document.xml', documentXml);
  let relationshipXml = await zip.file('word/_rels/document.xml.rels').async('string');
  relationshipXml = relationshipXml.replace('</Relationships>', `${relationships.join('')}</Relationships>`);
  zip.file('word/_rels/document.xml.rels', relationshipXml);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
