import React, { useState } from 'react';
import { loadEditorProfile, sharedClient } from './sharedEdition.js';
import { accountForUsername } from './editorAccounts.js';
import { useEscapeToClose } from './useEscapeToClose.js';

export default function EditorLoginDialog({ onLogin, onClose }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEscapeToClose('editor-login-title', onClose);

  async function submit(event) {
    event.preventDefault();
    if (!sharedClient) return setError('Shared editing is not configured yet.');
    setBusy(true);
    setError('');
    try {
      const account = accountForUsername(username);
      if (!account) throw new Error('Unknown username.');
      const { data, error: failure } = await sharedClient.auth.signInWithPassword({ email: account.email, password });
      if (failure) throw failure;
      const profile = await loadEditorProfile(data.user);
      if (!profile) {
        await sharedClient.auth.signOut();
        throw new Error('This account cannot edit the DNU.');
      }
      setPassword('');
      onLogin({ ...data.user, editorProfile: profile });
    } catch (failure) { setError(failure.message || 'Could not sign in.'); }
    finally { setBusy(false); }
  }

  return <div className="add-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="add-dialog editor-login-dialog" role="dialog" aria-modal="true" aria-labelledby="editor-login-title" onSubmit={submit}>
      <div className="add-dialog-heading"><h2 id="editor-login-title">Editor login</h2><button type="button" onClick={onClose} aria-label="Close login">×</button></div>
      <label>Username<input type="text" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required/></label>
      <label>Password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required/></label>
      {error && <p role="alert" className="add-manual-error">{error}</p>}
      <div className="add-dialog-actions"><button type="button" onClick={onClose}>Cancel</button><button className="import-spreadsheet-confirm" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Log in'}</button></div>
    </form>
  </div>;
}
