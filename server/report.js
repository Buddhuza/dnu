import { Document, ExternalHyperlink, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';

const sentence = text => /[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`;
const dateLabel = () => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Vienna' }).format(new Date());

export async function createReportDocx({ title, articles, sourceOutcomes = [], coverageNote = '' }) {
  const children = [
    new Paragraph({ text: title || `DAILY NEWS UPDATE, ${dateLabel()}`, heading: HeadingLevel.TITLE }),
    new Paragraph({ text: 'Security and political news · last 24 hours', spacing: { after: 220 } })
  ];
  let currentSection = '', currentSubsection = '';
  for (const item of articles) {
    if (item.section !== currentSection) {
      currentSection = item.section;
      currentSubsection = '';
      children.push(new Paragraph({ text: currentSection.toUpperCase(), heading: HeadingLevel.HEADING_1 }));
    }
    if (item.subsection && item.subsection !== currentSubsection) {
      currentSubsection = item.subsection;
      children.push(new Paragraph({ text: currentSubsection.toUpperCase(), heading: HeadingLevel.HEADING_2 }));
    }
    children.push(new Paragraph({
      spacing: { after: 160 },
      children: [
        new TextRun({ text: `${sentence(item.title)} `, bold: true }),
        new TextRun({ text: `${sentence(item.summary)} ` }),
        new ExternalHyperlink({ link: item.url, children: [new TextRun({ text: `(${item.sourceName})`, style: 'Hyperlink' })] })
      ]
    }));
  }
  const missing = sourceOutcomes.filter(x => x.status !== 'collected');
  if (coverageNote) {
    children.push(new Paragraph({ text: 'COVERAGE NOTE', heading: HeadingLevel.HEADING_1 }));
    children.push(new Paragraph({ text: coverageNote }));
  }
  if (missing.length) {
    children.push(new Paragraph({ text: 'AGENCIES FROM WHICH NO VERIFIED ARTICLE WAS COLLECTED', heading: HeadingLevel.HEADING_1 }));
    for (const item of missing) children.push(new Paragraph({ text: `${item.name}: ${item.status}` }));
  }
  const document = new Document({ sections: [{ children }] });
  return Packer.toBuffer(document);
}
