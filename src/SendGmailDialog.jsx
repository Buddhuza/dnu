import React, { useState } from 'react';
import { parseGmailRecipients } from './gmailRecipients.js';
import { useEscapeToClose } from './useEscapeToClose.js';

export default function SendGmailDialog({ recipients, subject, articleCount, onSave, onSend, onClose }) {
  const [recipientText, setRecipientText] = useState(() => recipients.join('\n'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEscapeToClose('send-gmail-title', () => { if (!busy) onClose(); });

  async function submit(action) {
    setError('');
    setMessage('');
    let parsed;
    try { parsed = parseGmailRecipients(recipientText); }
    catch (failure) { setError(failure.message); return; }
    setBusy(true);
    try {
      await (action === 'send' ? onSend(parsed) : onSave(parsed));
      setRecipientText(parsed.join('\n'));
      if (action === 'send') onClose();
      else setMessage('Recipients saved to the shared address book.');
    } catch (failure) { setError(failure.message || 'Could not save the recipients.'); }
    finally { setBusy(false); }
  }

  return <div className="add-backdrop" onMouseDown={event => { if (!busy && event.target === event.currentTarget) onClose(); }}>
    <section className="add-dialog send-gmail-dialog" role="dialog" aria-modal="true" aria-labelledby="send-gmail-title">
      <div className="add-dialog-heading"><h2 id="send-gmail-title">Send update</h2><button type="button" aria-label="Close send dialog" onClick={onClose} disabled={busy}>×</button></div>
      <p><strong>Subject:</strong> {subject}</p>
      <p>{articleCount} published {articleCount === 1 ? 'story' : 'stories'} will be sent from OSCE SitRoom.</p>
      <label htmlFor="send-gmail-recipients">Recipients</label>
      <textarea id="send-gmail-recipients" rows="6" value={recipientText} onChange={event => setRecipientText(event.target.value)} placeholder="name@example.com" disabled={busy}/>
      <p className="send-gmail-hint">One email address per line. Save or Send updates the main address book for everyone.</p>
      {error && <p role="alert" className="add-manual-error">{error}</p>}
      {message && <p role="status">{message}</p>}
      <div className="add-dialog-actions"><button type="button" onClick={onClose} disabled={busy}>Cancel</button><button type="button" onClick={() => submit('save')} disabled={busy}>Save recipients</button><button type="submit" onClick={() => submit('send')} disabled={busy}>{busy ? 'Working…' : 'Send'}</button></div>
    </section>
  </div>;
}
