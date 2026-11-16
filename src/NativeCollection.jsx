import React, { useEffect, useRef, useState } from 'react';
import { sharedClient } from './sharedEdition.js';
import { apiUrl } from './apiUrl.js';
import { fetchGithubDraft, githubCollectionStatus, startGithubCollection } from './githubCollection.js';

function GithubCollection({ onEditionReady, draftMode, onReturn }) {
  const [status, setStatus] = useState({ state: 'checking', message: 'Checking scrape status…' });
  const [error, setError] = useState('');
  const pending = useRef(null);
  const requesting = useRef(false);
  const failedRequest = useRef(false);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const result = await githubCollectionStatus();
      if (!active || requesting.current || failedRequest.current) return;
      if (pending.current) {
        const observedAt = Date.parse(result.createdAt || result.checkedAt || '');
        if (result.state === 'idle' || result.runId === pending.current.runId || (Number.isFinite(observedAt) && observedAt < pending.current.startedAt - 5_000)) return;
      }
      if (pending.current) pending.current = null;
      setStatus(result);
    };
    refresh();
    const timer = setInterval(refresh, 20_000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  async function start(previousRunId = status.runId) {
    requesting.current = true;
    failedRequest.current = false;
    setError('');
    setStatus({ state: 'starting', message: 'Starting a fresh scrape…' });
    try {
      await startGithubCollection(sharedClient);
      pending.current = { runId: previousRunId, startedAt: Date.now() };
      setStatus({ state: 'running', message: 'Scrape requested. Waiting for collection to begin…' });
    } catch (failure) {
      failedRequest.current = true;
      setError(failure.message);
      setStatus({ state: 'failed', message: 'Scrape could not start.' });
    } finally {
      requesting.current = false;
    }
  }
  async function loadDraft() {
    try { setError(''); await onEditionReady(await fetchGithubDraft()); }
    catch (failure) { setError(failure.message); }
  }
  return <section className="native-collection">
    <p>Scrape publisher sites into a new review draft. The published update changes only when you publish the draft.</p>
    <button type="button" className="cms-primary" onClick={() => start()} disabled={['starting', 'running'].includes(status.state)}>Scrape now</button>
    <p role="status">{status.message}</p>
    <button type="button" onClick={loadDraft} disabled={status.state === 'starting' || status.state === 'running'}>Load latest draft</button>
    {error && <p role="alert">{error}</p>}
    {draftMode && <button type="button" onClick={onReturn}>Return to published update</button>}
  </section>;
}

function NodeCollection({ onEditionReady, draftMode, onReturn }) {
  const [status, setStatus] = useState({ state: 'checking' });
  const lastCompleted = useRef('');
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(apiUrl('/api/collection'), { cache: 'no-store' });
        if (!response.ok) throw new Error('Collection server unavailable');
        const result = await response.json();
        if (!active) return;
        setStatus(result);
        if (result.state === 'complete' && result.checkedAt !== lastCompleted.current) {
          lastCompleted.current = result.checkedAt;
          await onEditionReady();
        }
      } catch { if (active) setStatus({ state: 'unavailable', message: 'The scraper is unavailable. Please try again later.' }); }
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
      const response = await fetch(apiUrl('/api/collection'), { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not start collection.');
      setStatus(result);
    } catch (error) { setStatus({ state: 'failed', message: error.message }); }
  }
  return <section className="native-collection">
    <p>Collect directly from publisher feeds and pages. The completed JSON is a draft until you publish it separately.</p>
    <button type="button" className="cms-primary" onClick={start} disabled={!sharedClient || ['running', 'unavailable', 'checking'].includes(status.state)}>Scrape now</button>
    <p role="status">{status.message || (status.state === 'idle' ? 'Ready to collect.' : status.state === 'checking' ? 'Checking collector…' : '')}</p>
    {status.state === 'running' && status.total > 0 && <><progress value={status.completed || 0} max={status.total} aria-label="Scraping progress"/><p>{status.completed || 0} of {status.total} {status.phase === 'routes' ? 'source routes checked' : status.phase === 'articles' ? 'article pages checked' : 'full texts checked'}{Number.isFinite(status.candidates) ? ` · ${status.candidates} candidates found` : ''}</p></>}
    {draftMode && <button type="button" onClick={onReturn}>Return to published update</button>}
  </section>;
}

export default function NativeCollection(props) {
  return typeof window !== 'undefined' && window.DNU_COLLECTION_MODE === 'github'
    ? <GithubCollection {...props}/>
    : <NodeCollection {...props}/>;
}
