import React, { useEffect, useRef, useState } from 'react';
import { sharedClient } from './sharedEdition.js';
import { apiUrl } from './apiUrl.js';
import { fetchGithubDraft, githubCollectionStatus, githubCollectionWorkflow } from './githubCollection.js';

function GithubCollection({ onEditionReady, draftMode, onReturn }) {
  const [status, setStatus] = useState({ state: 'checking', message: 'Checking GitHub collection…' });
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = () => githubCollectionStatus().then(result => { if (active) setStatus(result); });
    refresh();
    const timer = setInterval(refresh, 20_000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  async function loadDraft() {
    try { setError(''); await onEditionReady(await fetchGithubDraft()); }
    catch (failure) { setError(failure.message); }
  }
  return <section className="native-collection">
    <p>GitHub collects the news without a separate server. The completed JSON is a draft until you publish it.</p>
    <a className="cms-primary" href={githubCollectionWorkflow} target="_blank" rel="noopener noreferrer">Open GitHub scraper ↗</a>
    <p>In GitHub, choose <strong>Run workflow</strong> on the <strong>main</strong> branch. Return here to load the finished draft.</p>
    <p role="status">{status.message}</p>
    {status.runUrl && <p><a href={status.runUrl} target="_blank" rel="noopener noreferrer">View latest run ↗</a></p>}
    <button type="button" onClick={loadDraft}>Load latest draft</button>
    {error && <p role="alert">{error}</p>}
    {draftMode && <button type="button" onClick={onReturn}>Return to published update</button>}
  </section>;
}

function NodeCollection({ onEditionReady, draftMode, onReturn, autoStart = false }) {
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

export default function NativeCollection(props) {
  return typeof window !== 'undefined' && window.DNU_COLLECTION_MODE === 'github'
    ? <GithubCollection {...props}/>
    : <NodeCollection {...props}/>;
}
