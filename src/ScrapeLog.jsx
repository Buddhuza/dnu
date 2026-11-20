import React, { useEffect, useState } from 'react';
import { formatViennaCompactDateTime } from './viennaTime.js';

export default function ScrapeLog() {
  const [entries, setEntries] = useState([]);
  const [state, setState] = useState('loading');
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}native-collection-log.json`, { cache: 'no-store' });
        if (!response.ok) throw new Error('The scrape log is unavailable.');
        const data = await response.json();
        if (!Array.isArray(data.entries)) throw new Error('The scrape log could not be read.');
        if (active) { setEntries(data.entries); setState('ready'); }
      } catch { if (active) setState(current => current === 'ready' ? current : 'unavailable'); }
    };
    refresh();
    const timer = setInterval(refresh, 30_000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  return <section className="scrape-log" aria-labelledby="scrape-log-title">
    <h3 id="scrape-log-title">Scrape log</h3>
    {state === 'loading' && <p className="cms-help">Loading scrape history…</p>}
    {state === 'unavailable' && <p className="cms-help">Scrape history is unavailable right now. New runs will appear here after their result is recorded.</p>}
    {state === 'ready' && !entries.length && <p className="cms-help">No scrape results have been recorded yet.</p>}
    {entries.map(entry => <article className="scrape-log-entry" key={entry.runId}>
      <div className="scrape-log-heading">
        <time dateTime={entry.finishedAt}>{formatViennaCompactDateTime(entry.finishedAt)} Vienna</time>
        <span className="scrape-log-trigger">{entry.trigger === 'manual' ? 'Manual' : 'Automatic'}</span>
        <span className={`scrape-log-outcome scrape-log-outcome-${entry.outcome}`}>
          {entry.outcome === 'succeeded' ? '✓ Successful' : entry.outcome === 'cancelled' ? '– Cancelled' : '✕ Failed'}
        </span>
      </div>
      <p>{entry.description}</p>
      {entry.startedAt && <small>Started {formatViennaCompactDateTime(entry.startedAt)} Vienna</small>}
    </article>)}
  </section>;
}
