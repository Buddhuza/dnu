import React, { useState } from 'react';
import { editorEmail, sharedClient } from './sharedEdition.js';

export default function EditorLoginDialog({ onLogin, onClose }) {
  const [email, setEmail] = useState(editorEmail);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!sharedClient) return setError('Shared editing is not configured yet.');
    setBusy(true);
    setError('');
    try {
      const { data, error: failure } = await sharedClient.auth.signInWithPassword({ email: email.trim(), password });
      if (failure) throw failure;
      if (data.user?.email?.toLowerCase() !== editorEmail) {
        await sharedClient.auth.signOut();
        throw new Error('This account cannot edit the DNU.');
      }
      setPassword('');
      onLogin(data.user);
    } catch (failure) { setError(failure.message || 'Could not sign in.'); }
    finally { setBusy(false); }
  }

  return <div className="add-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="add-dialog editor-login-dialog" role="dialog" aria-modal="true" aria-labelledby="editor-login-title" onSubmit={submit}>
      <div className="add-dialog-heading"><h2 id="editor-login-title">Editor login</h2><button type="button" onClick={onClose} aria-label="Close login">×</button></div>
      <label>Email<input type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required/></label>
      <label>Password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required/></label>
      {error && <p role="alert" className="add-manual-error">{error}</p>}
      <div className="add-dialog-actions"><button type="button" onClick={onClose}>Cancel</button><button className="import-spreadsheet-confirm" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Log in'}</button></div>
    </form>
  </div>;
}
