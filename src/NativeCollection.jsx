import React, { useEffect, useRef, useState } from 'react';
import { sharedClient } from './sharedEdition.js';

export default function NativeCollection({ onEditionReady, draftMode, onReturn }) {
  const [status, setStatus] = useState({ state: 'checking' });
  const lastCompleted = useRef('');
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch('/api/collection', { cache: 'no-store' });
        if (!response.ok) throw new Error('Collection server unavailable');
        const result = await response.json();
        if (!active) return;
        setStatus(result);
        if (result.state === 'complete' && result.checkedAt !== lastCompleted.current) {
          lastCompleted.current = result.checkedAt;
          await onEditionReady();
        }
      } catch { if (active) setStatus({ state: 'unavailable', message: 'Start the Node DNU server to collect news.' }); }
    };
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [onEditionReady]);
  async function start() {
    setStatus({ state: 'running', message: 'Checking publisher sources…' });
    try {
      const { data } = await sharedClient.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Sign in as the editor first.');
      const response = await fetch('/api/collection', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not start collection.');
      setStatus(result);
    } catch (error) { setStatus({ state: 'failed', message: error.message }); }
  }
  return <section className="native-collection">
    <h2>Collect daily edition</h2>
    <p>Collect directly from publisher feeds and pages. The completed JSON is a draft until you publish it separately.</p>
    <button type="button" className="cms-primary" onClick={start} disabled={!sharedClient || ['running', 'unavailable', 'checking'].includes(status.state)}>Collect</button>
    <p role="status">{status.message || (status.state === 'idle' ? 'Ready to collect.' : status.state === 'checking' ? 'Checking collector…' : '')}</p>
    {draftMode && <button type="button" onClick={onReturn}>Return to published update</button>}
  </section>;
}
