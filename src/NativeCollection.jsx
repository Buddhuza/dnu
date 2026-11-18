import React, { useEffect, useRef, useState } from 'react';
import { sharedClient } from './sharedEdition.js';
import { apiUrl } from './apiUrl.js';
import { fetchGithubDraft, fetchGithubDraftStatus, githubCollectionStatus, startGithubCollection } from './githubCollection.js';
import { formatViennaCompactDateTime } from './viennaTime.js';

function ActivityDots({ active }) {
  return active && <span className="native-activity-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>;
}

function scrapedStoryCount(value) {
  const count = Number(value);
  return Number.isInteger(count) && count >= 0 ? ` with ${count} ${count === 1 ? 'story' : 'stories'}` : '';
}

function scrapeKind(trigger) {
  return trigger === 'manual' ? 'manual ' : trigger === 'automatic' ? 'automatic ' : '';
}

function GithubCollection({ onPublish, onClear, hasStories }) {
  const [status, setStatus] = useState({ state: 'checking', message: 'Checking scrape status…' });
  const [latestDraft, setLatestDraft] = useState(null);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const pending = useRef(null);
  const requesting = useRef(false);
  const failedRequest = useRef(false);
  const publishingRef = useRef(false);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const [result, draftStatus] = await Promise.all([githubCollectionStatus(), fetchGithubDraftStatus().catch(() => null)]);
      if (!active || requesting.current || failedRequest.current || publishingRef.current) return;
      if (draftStatus) setLatestDraft(draftStatus);
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
  const finishedAt = latestDraft?.finishedAt || (latestDraft?.runId === status.runId && status.state === 'complete' ? status.updatedAt : '') || latestDraft?.checkedAt;
  const finishedLabel = formatViennaCompactDateTime(finishedAt);
  const latestTrigger = latestDraft?.trigger || (latestDraft?.runId === status.runId ? status.trigger : null);
  const statusMessage = publishing ? 'Publishing the latest scrape' : status.state === 'complete' && latestDraft
    ? `Latest completed draft: ${latestDraft.stories} stories.` : status.message;
  return <section className="native-collection">
    <p className="native-publish-description">{finishedLabel ? <>Publish the latest {scrapeKind(latestTrigger)}scrape, completed <time dateTime={finishedAt}>{finishedLabel}</time>{scrapedStoryCount(latestDraft?.stories)}.</> : 'Publish the latest completed scrape.'}</p>
    <button type="button" className="cms-primary" onClick={publishDraft} disabled={busy}>Publish</button>
    <p className="native-scrape-description">Scrape manually if you need a newer update.</p>
    <button type="button" className="native-secondary" onClick={() => start()} disabled={busy}>Scrape</button>
    {onClear && <button type="button" className="native-clear-stories" onClick={onClear} disabled={!hasStories || publishing}>Clear all stories</button>}
    {error && <p role="alert">{error}</p>}
    <p role="status" className="native-status">{statusMessage?.replace(/(?:…|\.\.\.)$/, '')}<ActivityDots active={busy}/></p>
  </section>;
}

function NodeCollection({ onPublish, onClear, hasStories }) {
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
  const finishedAt = status.finishedAt || status.updatedAt || status.checkedAt;
  const finishedLabel = status.state === 'complete' ? formatViennaCompactDateTime(finishedAt) : '';
  return <section className="native-collection">
    <p className="native-publish-description">{finishedLabel ? <>Publish the latest {scrapeKind(status.trigger)}scrape, completed <time dateTime={finishedAt}>{finishedLabel}</time>{scrapedStoryCount(status.stories)}.</> : 'Publish the latest completed scrape.'}</p>
    <button type="button" className="cms-primary" onClick={publishDraft} disabled={busy || status.state !== 'complete'}>Publish</button>
    <p className="native-scrape-description">Scrape manually if you need a newer update.</p>
    <button type="button" className="native-secondary" onClick={start} disabled={!sharedClient || busy || status.state === 'unavailable'}>Scrape</button>
    {onClear && <button type="button" className="native-clear-stories" onClick={onClear} disabled={!hasStories || publishing}>Clear all stories</button>}
    {error && <p role="alert">{error}</p>}
    <p role="status" className="native-status">{(publishing ? 'Publishing the latest scrape' : status.message || (status.state === 'idle' ? 'Ready to scrape.' : status.state === 'checking' ? 'Checking collector…' : '')).replace(/(?:…|\.\.\.)$/, '')}{status.state === 'running' && status.total > 0 && <> {status.completed || 0} of {status.total} {status.phase === 'routes' ? 'source routes checked' : status.phase === 'articles' ? 'article pages checked' : 'full texts checked'}{Number.isFinite(status.candidates) ? ` · ${status.candidates} candidates found` : ''}</>}<ActivityDots active={busy}/></p>
  </section>;
}

export default function NativeCollection(props) {
  return typeof window !== 'undefined' && window.DNU_COLLECTION_MODE === 'github'
    ? <GithubCollection {...props}/>
    : <NodeCollection {...props}/>;
}
