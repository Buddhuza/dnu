export const MAX_ADDRESS_BOOK_CONTACTS = 5000;
export const MAX_MAIL_RECIPIENTS = 400;

const emailPattern = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

export function cleanAddress(value) {
  const email = String(value || '').trim().toLowerCase();
  return email.length <= 254 && emailPattern.test(email) ? email : '';
}

export function normaliseContact(input) {
  const email = cleanAddress(input.email);
  if (!email) return null;
  return {
    email,
    display_name: String(input.display_name || '').trim().slice(0, 160),
    company: String(input.company || '').trim().slice(0, 160),
    category: String(input.category || '').trim().slice(0, 120)
  };
}

function splitCsv(text, separator) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index++; }
      else quoted = !quoted;
    } else if (char === separator && !quoted) { row.push(field); field = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index++;
      row.push(field); field = '';
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
    } else field += char;
  }
  if (quoted) throw new Error('The contact CSV has an unclosed quoted field.');
  row.push(field);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

const key = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const pick = (row, headers, names) => {
  for (const name of names) {
    const index = headers.indexOf(name);
    if (index >= 0 && row[index]?.trim()) return row[index].trim();
  }
  return '';
};

export function parseOutlookContacts(text) {
  const source = String(text || '').replace(/^\ufeff/, '');
  const firstLine = source.split(/\r?\n/, 1)[0] || '';
  const separator = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = splitCsv(source, separator);
  if (!rows.length) throw new Error('The contact file is empty.');
  const headers = rows[0].map(key);
  const emailColumns = ['emailaddress', 'email', 'email1address', 'email2address', 'email3address', 'primaryemail', 'mail'];
  if (!emailColumns.some(name => headers.includes(name))) throw new Error('The CSV needs an E-mail Address or Email column.');
  const contacts = [];
  let skipped = 0;
  for (const row of rows.slice(1)) {
    const first = pick(row, headers, ['firstname', 'givenname']);
    const last = pick(row, headers, ['lastname', 'surname', 'familyname']);
    const name = pick(row, headers, ['displayname', 'fullname', 'name']) || [first, last].filter(Boolean).join(' ');
    const company = pick(row, headers, ['company', 'companyname', 'organization', 'organisation']);
    const category = pick(row, headers, ['categories', 'category', 'group']);
    let found = false;
    for (const column of emailColumns) {
      const index = headers.indexOf(column);
      if (index < 0 || !row[index]?.trim()) continue;
      const contact = normaliseContact({ email: row[index], display_name: name, company, category });
      if (contact) { contacts.push(contact); found = true; }
      else skipped++;
    }
    if (!found) skipped++;
  }
  const unique = [...contacts.reduce((byEmail, contact) => {
    const previous = byEmail.get(contact.email);
    byEmail.set(contact.email, previous ? { ...previous, ...Object.fromEntries(Object.entries(contact).filter(([, value]) => value)) } : contact);
    return byEmail;
  }, new Map()).values()];
  if (unique.length > MAX_ADDRESS_BOOK_CONTACTS) throw new Error(`Import at most ${MAX_ADDRESS_BOOK_CONTACTS} contacts at once.`);
  return { contacts: unique, skipped };
}

export function parseVCardContacts(text) {
  const cards = String(text || '').replace(/\r?\n[ \t]/g, '').split(/BEGIN:VCARD/i).slice(1);
  const contacts = [];
  let skipped = 0;
  for (const card of cards) {
    const lines = card.split(/\r?\n/);
    const find = name => lines.find(line => new RegExp(`^${name}(?:;[^:]*)?:`, 'i').test(line))?.split(':').slice(1).join(':').trim().replace(/\\([,;\\n])/g, '$1') || '';
    const name = find('FN') || find('N').split(';').reverse().filter(Boolean).join(' ');
    const company = find('ORG').split(';')[0];
    const category = find('CATEGORIES');
    let found = false;
    for (const line of lines.filter(line => /^EMAIL(?:;[^:]*)?:/i.test(line))) {
      const contact = normaliseContact({ email: line.split(':').slice(1).join(':'), display_name: name, company, category });
      if (contact) { contacts.push(contact); found = true; }
      else skipped++;
    }
    if (!found) skipped++;
  }
  const unique = [...contacts.reduce((byEmail, contact) => {
    const previous = byEmail.get(contact.email);
    byEmail.set(contact.email, previous ? { ...previous, ...Object.fromEntries(Object.entries(contact).filter(([, value]) => value)) } : contact);
    return byEmail;
  }, new Map()).values()];
  if (!unique.length) throw new Error('No valid email addresses were found in this vCard file.');
  if (unique.length > MAX_ADDRESS_BOOK_CONTACTS) throw new Error(`Import at most ${MAX_ADDRESS_BOOK_CONTACTS} contacts at once.`);
  return { contacts: unique, skipped };
}

export function contactsToOutlookCsv(contacts) {
  const quote = value => `"${String(value || '').replace(/"/g, '""')}"`;
  return '\ufeff' + [
    ['Display Name', 'E-mail Address', 'Company', 'Categories'],
    ...contacts.map(contact => [contact.display_name, contact.email, contact.company, contact.category])
  ].map(row => row.map(quote).join(',')).join('\r\n') + '\r\n';
}
