import React, { useEffect, useRef, useState } from 'react';
import { sharedClient } from './sharedEdition.js';
import { apiUrl } from './apiUrl.js';

export default function NativeCollection({ onEditionReady, draftMode, onReturn, autoStart = false }) {
  const [status, setStatus] = useState({ state: 'checking' });
  const lastCompleted = useRef('');
  const startedAutomatically = useRef(false);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(apiUrl('/api/collection'), { cache: 'no-store' });
        if (!response.ok) throw new Error('Collection server unavailable');
        const result = await response.json();
        if (!active) return;
        setStatus(result);
        if (autoStart && !startedAutomatically.current) {
          startedAutomatically.current = true;
          if (result.state !== 'running') { await start(); return; }
        }
        if (result.state === 'complete' && result.checkedAt !== lastCompleted.current) {
          lastCompleted.current = result.checkedAt;
          await onEditionReady();
        }
      } catch { if (active) setStatus({ state: 'unavailable', message: 'The collection server is unavailable. You can run a draft collection in GitHub Actions.' }); }
    };
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [onEditionReady, autoStart]);
  async function start() {
    setStatus({ state: 'running', message: 'Checking publisher sources…' });
    try {
      const { data } = await sharedClient.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Sign in as the editor first.');
      const response = await fetch(apiUrl('/api/collection'), { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not start collection.');
      setStatus(result);
    } catch (error) { setStatus({ state: 'failed', message: error.message }); }
  }
  return <section className="native-collection">
    {!autoStart && <h2>Scrape daily edition</h2>}
    <p>Collect directly from publisher feeds and pages. The completed JSON is a draft until you publish it separately.</p>
    <button type="button" className="cms-primary" onClick={start} disabled={!sharedClient || ['running', 'unavailable', 'checking'].includes(status.state)}>Scrape now</button>
    <p role="status">{status.message || (status.state === 'idle' ? 'Ready to collect.' : status.state === 'checking' ? 'Checking collector…' : '')}</p>
    {status.state === 'unavailable' && <p><a href="https://github.com/Buddhuza/dnu/actions/workflows/test-daily-collection.yml" target="_blank" rel="noopener noreferrer">Open manual collection job ↗</a> Select the branch containing the native collector before running it.</p>}
    {status.state === 'running' && status.total > 0 && <><progress value={status.completed || 0} max={status.total} aria-label="Scraping progress"/><p>{status.completed || 0} of {status.total} {status.phase === 'routes' ? 'source routes checked' : status.phase === 'articles' ? 'article pages checked' : 'full texts checked'}{Number.isFinite(status.candidates) ? ` · ${status.candidates} candidates found` : ''}</p></>}
    {draftMode && <button type="button" onClick={onReturn}>Return to published update</button>}
  </section>;
}
