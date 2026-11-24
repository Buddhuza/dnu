import React, { useEffect, useMemo, useState } from 'react';
import { sharedClient } from './sharedEdition.js';
import { cleanAddress, normaliseContact, parseOutlookContacts, parseVCardContacts, contactsToOutlookCsv, MAX_ADDRESS_BOOK_CONTACTS, MAX_MAIL_RECIPIENTS } from './addressBook.js';

const PAGE_SIZE = 50;

async function readContacts() {
  const rows = [];
  for (let start = 0; start < MAX_ADDRESS_BOOK_CONTACTS; start += 1000) {
    const { data, error } = await sharedClient.from('dnu_address_book').select('email,display_name,company,category,selected').order('email').range(start, start + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

export default function AddressBook({ onSelectedChange }) {
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [view, setView] = useState('All');
  const [page, setPage] = useState(0);
  const [form, setForm] = useState({ email: '', display_name: '', company: '', category: '' });
  const [editing, setEditing] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const selected = useMemo(() => contacts.filter(contact => contact.selected).map(contact => contact.email), [contacts]);
  const categories = useMemo(() => ['All', ...new Set(contacts.map(item => item.category).filter(Boolean))].sort(), [contacts]);
  const filtered = useMemo(() => contacts.filter(item => {
    if (view === 'Selected' && !item.selected) return false;
    if (category !== 'All' && item.category !== category) return false;
    return [item.display_name, item.email, item.company, item.category].some(value => value.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  }), [contacts, search, category, view]);
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  useEffect(() => { setPage(0); }, [search, category, view]);
  useEffect(() => {
    let active = true;
    readContacts().then(rows => { if (active) { setContacts(rows); onSelectedChange(rows.filter(item => item.selected).map(item => item.email)); } })
      .catch(failure => { if (active) setError(`Could not load the address book: ${failure.message}`); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function run(action) {
    setBusy(true); setError(''); setMessage('');
    try { await action(); }
    catch (failure) { setError(failure.message || 'The address book could not be changed.'); }
    finally { setBusy(false); }
  }
  async function choose(emails) {
    if (!emails.length) throw new Error('Keep at least one recipient selected for email delivery.');
    if (emails.length > MAX_MAIL_RECIPIENTS) throw new Error(`Select at most ${MAX_MAIL_RECIPIENTS} recipients for one message.`);
    const { data, error: failure } = await sharedClient.rpc('set_dnu_recipients', { p_emails: emails });
    if (failure) throw failure;
    const chosen = new Set(data);
    setContacts(current => current.map(contact => ({ ...contact, selected: chosen.has(contact.email) })));
    onSelectedChange(data);
    setMessage(`${data.length} recipients selected for the next email.`);
  }
  async function saveContact() {
    const contact = normaliseContact(form);
    if (!contact) throw new Error('Enter a valid email address.');
    if (!editing && contacts.length >= MAX_ADDRESS_BOOK_CONTACTS) throw new Error(`The address book holds up to ${MAX_ADDRESS_BOOK_CONTACTS} contacts.`);
    if (editing && editing !== contact.email && contacts.some(item => item.email === contact.email)) throw new Error('That address is already in the book.');
    const prior = contacts.find(item => item.email === editing || item.email === contact.email);
    const { error: failure } = await sharedClient.from('dnu_address_book').upsert({ ...contact, selected: prior?.selected || false, updated_at: new Date().toISOString() }, { onConflict: 'email' });
    if (failure) throw failure;
    if (editing && editing !== contact.email) {
      const { error: removeError } = await sharedClient.from('dnu_address_book').delete().eq('email', editing);
      if (removeError) throw removeError;
      if (prior?.selected) await choose(selected.map(email => email === editing ? contact.email : email));
    }
    setContacts(current => [...current.filter(item => item.email !== editing && item.email !== contact.email), { ...contact, selected: prior?.selected || false }].sort((a, b) => a.email.localeCompare(b.email)));
    setForm({ email: '', display_name: '', company: '', category: '' }); setEditing('');
    setMessage('Contact saved.');
  }
  async function removeContact(contact) {
    if (contact.selected && selected.length === 1) throw new Error('Select another recipient before removing the last selected contact.');
    const { error: failure } = await sharedClient.from('dnu_address_book').delete().eq('email', contact.email);
    if (failure) throw failure;
    setContacts(current => current.filter(item => item.email !== contact.email));
    if (contact.selected) onSelectedChange(selected.filter(email => email !== contact.email));
    setMessage('Contact removed.');
  }
  async function importFile(file) {
    if (!file) return;
    if (file.size > 5_000_000) throw new Error('Choose a CSV or vCard file under 5 MB.');
    const bytes = await file.arrayBuffer();
    const prefix = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 2));
    const encoding = prefix[0] === 0xff && prefix[1] === 0xfe ? 'utf-16le' : prefix[0] === 0xfe && prefix[1] === 0xff ? 'utf-16be' : 'utf-8';
    let text = new TextDecoder(encoding).decode(bytes);
    if (encoding === 'utf-8' && text.includes('�')) text = new TextDecoder('windows-1252').decode(bytes);
    const result = /\.vcf$/i.test(file.name) ? parseVCardContacts(text) : parseOutlookContacts(text);
    const known = new Map(contacts.map(item => [item.email, item]));
    const additions = result.contacts.filter(item => !known.has(item.email));
    if (contacts.length + additions.length > MAX_ADDRESS_BOOK_CONTACTS) throw new Error(`The address book holds up to ${MAX_ADDRESS_BOOK_CONTACTS} contacts.`);
    for (let start = 0; start < result.contacts.length; start += 100) {
      const rows = result.contacts.slice(start, start + 100).map(item => {
        const existing = known.get(item.email);
        return { ...item, display_name: item.display_name || existing?.display_name || '', company: item.company || existing?.company || '', category: item.category || existing?.category || '', selected: existing?.selected || false, updated_at: new Date().toISOString() };
      });
      const { error: failure } = await sharedClient.from('dnu_address_book').upsert(rows, { onConflict: 'email' });
      if (failure) throw failure;
    }
    setContacts(await readContacts());
    setMessage(`Imported ${additions.length} new contacts; updated ${result.contacts.length - additions.length}. ${result.skipped ? `${result.skipped} invalid or empty entries skipped.` : 'Choose recipients before sending.'}`);
  }
  function exportFile() {
    const blob = new Blob([contactsToOutlookCsv(contacts)], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = 'dnu-address-book-outlook.csv';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }
  return <section className="address-book">
    <div className="address-book-heading"><div><h3>Address book</h3><p className="cms-help">{contacts.length} contacts · {selected.length} selected for BCC. The update is addressed to sitroom.github@gmail.com.</p></div><div className="address-book-actions"><label className="cms-primary address-book-file">Import Outlook CSV or vCard<input type="file" accept=".csv,.vcf,text/csv,text/vcard" disabled={busy} onChange={event => { const file = event.target.files?.[0]; run(() => importFile(file)); event.target.value = ''; }}/></label><button type="button" className="cms-primary" disabled={busy || !contacts.length} onClick={exportFile}>Export CSV</button></div></div>
    <p className="cms-help">Outlook: People → Manage contacts → Export contacts → CSV. Imported contacts are added to the book; choose which ones receive the update.</p>
    {loading && <p role="status">Loading address book…</p>}
    {error && <p role="alert" className="add-manual-error">{error}</p>}
    {message && <p role="status" className="cms-message">{message}</p>}
    <div className="address-book-add"><h4>{editing ? 'Edit contact' : 'Add contact'}</h4><div className="address-book-form"><label>Name<input value={form.display_name} onChange={event => setForm(current => ({ ...current, display_name: event.target.value }))}/></label><label>Email<input type="email" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))}/></label><label>Organisation<input value={form.company} onChange={event => setForm(current => ({ ...current, company: event.target.value }))}/></label><label>Group<input value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value }))}/></label><button type="button" className="cms-primary" disabled={busy || loading} onClick={() => run(saveContact)}>{editing ? 'Save contact' : 'Add contact'}</button>{editing && <button type="button" onClick={() => { setEditing(''); setForm({ email: '', display_name: '', company: '', category: '' }); }}>Cancel</button>}</div></div>
    <div className="address-book-filters"><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, email, organisation or group" aria-label="Search address book"/><select value={category} onChange={event => setCategory(event.target.value)} aria-label="Filter address book group">{categories.map(name => <option key={name}>{name}</option>)}</select><select value={view} onChange={event => setView(event.target.value)} aria-label="Filter selected contacts"><option>All</option><option>Selected</option></select></div>
    <div className="address-book-bulk"><span>{filtered.length} matching contacts</span><button type="button" disabled={busy || !filtered.length} onClick={() => run(() => choose([...new Set([...selected, ...filtered.map(item => item.email)])]))}>Select all matching</button><button type="button" disabled={busy || !filtered.length} onClick={() => run(() => choose(selected.filter(email => !filtered.some(item => item.email === email))))}>Deselect matching</button></div>
    <div className="address-book-list">{visible.map(contact => <div className="address-book-row" key={contact.email}><label className="address-book-select"><input type="checkbox" checked={contact.selected} disabled={busy} onChange={() => run(() => choose(contact.selected ? selected.filter(email => email !== contact.email) : [...selected, contact.email]))} aria-label={`Send to ${contact.display_name || contact.email}`}/></label><div className="address-book-contact"><strong>{contact.display_name || contact.email}</strong><span>{contact.email}</span><small>{[contact.company, contact.category].filter(Boolean).join(' · ')}</small></div><button type="button" disabled={busy} onClick={() => { setEditing(contact.email); setForm({ email: contact.email, display_name: contact.display_name, company: contact.company, category: contact.category }); }}>Edit</button><button type="button" className="cms-danger" disabled={busy} onClick={() => run(() => removeContact(contact))} aria-label={`Remove ${contact.email}`}>Delete</button></div>)}{!loading && !visible.length && <p className="cms-help">No contacts match this search.</p>}</div>
    {filtered.length > PAGE_SIZE && <div className="address-book-pages"><button type="button" disabled={page === 0} onClick={() => setPage(current => current - 1)}>Previous</button><span>Page {page + 1} of {Math.ceil(filtered.length / PAGE_SIZE)}</span><button type="button" disabled={(page + 1) * PAGE_SIZE >= filtered.length} onClick={() => setPage(current => current + 1)}>Next</button></div>}
  </section>;
}
