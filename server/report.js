import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createReportDocxFromTemplate } from '../src/docxBuilder.js';
import { compareCountryLabels } from '../src/newsSections.js';

const template = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'templates/daily-update-template.docx'));

export const createReportDocx = options => createReportDocxFromTemplate(template, {
  ...options,
  articles: [...(options.articles || [])].sort((a, b) => a.subsection === 'INTERNATIONAL ORGANISATIONS' && b.subsection === 'INTERNATIONAL ORGANISATIONS'
    ? compareCountryLabels(a.subsection, a.country || '', b.country || '') : 0)
});
