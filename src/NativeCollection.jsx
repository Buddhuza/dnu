import React, { useEffect, useRef, useState } from 'react';
import { sharedClient } from './sharedEdition.js';
import { apiUrl } from './apiUrl.js';
import { fetchGithubDraft, githubCollectionStatus, startGithubCollection } from './githubCollection.js';

function ActivityDots({ active }) {
  return active && <span className="native-activity-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>;
}

function GithubCollection({ onPublish }) {
  const [status, setStatus] = useState({ state: 'checking', message: 'Checking scrape status…' });
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const pending = useRef(null);
  const requesting = useRef(false);
  const failedRequest = useRef(false);
  const publishingRef = useRef(false);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const result = await githubCollectionStatus();
      if (!active || requesting.current || failedRequest.current || publishingRef.current) return;
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
    } finally { requesting.current = false; }
  }
  async function publishDraft() {
    publishingRef.current = true;
    setPublishing(true);
    setError('');
    try {
      const edition = await fetchGithubDraft();
      await onPublish(edition);
    } catch (failure) { setError(`Not published: ${failure.message}`); }
    finally { publishingRef.current = false; setPublishing(false); }
  }
  const busy = publishing || ['checking', 'starting', 'running'].includes(status.state);
  return <section className="native-collection">
    <button type="button" className="cms-primary" onClick={() => start()} disabled={busy}>Scrape now</button>
    <p role="status">{publishing ? 'Publishing the latest draft' : status.message?.replace(/(?:…|\.\.\.)$/, '')}<ActivityDots active={busy}/></p>
    <button type="button" onClick={publishDraft} disabled={busy}>Publish draft</button>
    {error && <p role="alert">{error}</p>}
  </section>;
}

function NodeCollection({ onPublish }) {
  const [status, setStatus] = useState({ state: 'checking' });
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(apiUrl('/api/collection'), { cache: 'no-store' });
        if (!response.ok) throw new Error('Collection server unavailable');
        const result = await response.json();
        if (active) setStatus(result);
      } catch { if (active) setStatus({ state: 'unavailable', message: 'The scraper is unavailable. Please try again later.' }); }
    };
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  async function start() {
    setError('');
    setStatus({ state: 'running', message: 'Checking publisher sources…' });
    try {
      const { data } = await sharedClient.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Sign in as the editor first.');
      const response = await fetch(apiUrl('/api/collection'), { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not start collection.');
      setStatus(result);
    } catch (failure) { setStatus({ state: 'failed', message: failure.message }); }
  }
  async function publishDraft() {
    setPublishing(true);
    setError('');
    try {
      const response = await fetch(apiUrl('/api/daily-update'), { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load the completed draft.');
      await onPublish(await response.json());
    } catch (failure) { setError(`Not published: ${failure.message}`); }
    finally { setPublishing(false); }
  }
  const busy = publishing || ['running', 'checking'].includes(status.state);
  return <section className="native-collection">
    <button type="button" className="cms-primary" onClick={start} disabled={!sharedClient || busy || status.state === 'unavailable'}>Scrape now</button>
    <p role="status">{(publishing ? 'Publishing the latest draft' : status.message || (status.state === 'idle' ? 'Ready to collect.' : status.state === 'checking' ? 'Checking collector…' : '')).replace(/(?:…|\.\.\.)$/, '')}<ActivityDots active={busy}/></p>
    {status.state === 'running' && status.total > 0 && <p>{status.completed || 0} of {status.total} {status.phase === 'routes' ? 'source routes checked' : status.phase === 'articles' ? 'article pages checked' : 'full texts checked'}{Number.isFinite(status.candidates) ? ` · ${status.candidates} candidates found` : ''}</p>}
    <button type="button" onClick={publishDraft} disabled={busy || status.state !== 'complete'}>Publish draft</button>
    {error && <p role="alert">{error}</p>}
  </section>;
}

export default function NativeCollection(props) {
  return typeof window !== 'undefined' && window.DNU_COLLECTION_MODE === 'github'
    ? <GithubCollection {...props}/>
    : <NodeCollection {...props}/>;
}
