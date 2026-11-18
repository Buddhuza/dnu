import React, { useState } from 'react';
import { sharedClient } from './sharedEdition.js';
import { useEscapeToClose } from './useEscapeToClose.js';

export default function EditorAccountDialog({ profile, onClose }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEscapeToClose('editor-account-title', onClose);

  async function changePassword(event) {
    event.preventDefault();
    setMessage('');
    setError('');
    if (password !== confirm) return setError('The passwords do not match.');
    setBusy(true);
    try {
      const { error: failure } = await sharedClient.auth.updateUser({ password });
      if (failure) throw failure;
      setPassword('');
      setConfirm('');
      setMessage('Password changed. Use the new password next time you log in.');
    } catch (failure) { setError(failure.message || 'Could not change your password.'); }
    finally { setBusy(false); }
  }

  return <div className="add-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="add-dialog editor-login-dialog" role="dialog" aria-modal="true" aria-labelledby="editor-account-title" onSubmit={changePassword}>
      <div className="add-dialog-heading"><h2 id="editor-account-title">Account</h2><button type="button" onClick={onClose} aria-label="Close account">×</button></div>
      <p>Signed in as <strong>{profile.username || profile.display_name}</strong></p>
      <label>New password<input type="password" autoComplete="new-password" minLength="6" value={password} onChange={event => setPassword(event.target.value)} required/></label>
      <label>Confirm new password<input type="password" autoComplete="new-password" minLength="6" value={confirm} onChange={event => setConfirm(event.target.value)} required/></label>
      {error && <p role="alert" className="add-manual-error">{error}</p>}
      {message && <p role="status">{message}</p>}
      <div className="add-dialog-actions"><button type="button" onClick={onClose}>Close</button><button className="import-spreadsheet-confirm" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button></div>
    </form>
  </div>;
}
