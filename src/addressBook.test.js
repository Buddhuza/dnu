import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOutlookContacts, parseVCardContacts, contactsToOutlookCsv } from './addressBook.js';

test('Outlook CSV imports names, multiple addresses, quoted commas and deduplicates', () => {
  const csv = '\ufeffFirst Name,Last Name,E-mail Address,E-mail 2 Address,Company,Categories\r\nAda,Lovelace,ADA@example.com,ada.work@example.com,"Policy, Security",Editors\r\nAda,Lovelace,ada@example.com,,,\r\n';
  const result = parseOutlookContacts(csv);
  assert.equal(result.contacts.length, 2);
  assert.deepEqual(result.contacts[0], { email: 'ada@example.com', display_name: 'Ada Lovelace', company: 'Policy, Security', category: 'Editors' });
  assert.equal(result.contacts[1].company, 'Policy, Security');
});

test('semicolon CSV and Outlook vCard contacts can be imported', () => {
  assert.equal(parseOutlookContacts('Display Name;E-mail Address\r\n"Jane Doe";jane@example.org').contacts[0].display_name, 'Jane Doe');
  assert.equal(parseVCardContacts('BEGIN:VCARD\nFN:Jane Doe\nEMAIL;TYPE=WORK:jane@example.org\nEND:VCARD').contacts[0].email, 'jane@example.org');
});

test('exported contact CSV can be imported again', () => {
  const input = [{ email: 'jane@example.org', display_name: 'Jane "J" Doe', company: 'OSCE', category: 'News' }];
  assert.deepEqual(parseOutlookContacts(contactsToOutlookCsv(input)).contacts, input);
});
