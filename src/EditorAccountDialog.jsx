import React, { useState } from 'react';
import { sharedClient } from './sharedEdition.js';
import { useEscapeToClose } from './useEscapeToClose.js';

export function EditorAccountForm({ profile }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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

  return <form className="cms-fields editor-account-form" onSubmit={changePassword}>
      <h3>Account</h3>
      <p>Signed in as <strong>{profile.username || profile.display_name}</strong></p>
      <label>New password<input type="password" autoComplete="new-password" minLength="6" value={password} onChange={event => setPassword(event.target.value)} required/></label>
      <label>Confirm new password<input type="password" autoComplete="new-password" minLength="6" value={confirm} onChange={event => setConfirm(event.target.value)} required/></label>
      {error && <p role="alert" className="add-manual-error">{error}</p>}
      {message && <p role="status">{message}</p>}
      <button className="cms-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
    </form>;
}

export default function EditorAccountDialog({ profile, onClose }) {
  useEscapeToClose('editor-account-title', onClose);
  return <div className="add-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="add-dialog editor-login-dialog" role="dialog" aria-modal="true" aria-labelledby="editor-account-title">
      <div className="add-dialog-heading"><h2 id="editor-account-title">Account</h2><button type="button" onClick={onClose} aria-label="Close account">×</button></div>
      <EditorAccountForm profile={profile}/>
    </section>
  </div>;
}
