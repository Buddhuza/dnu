import React, { useEffect, useState } from 'react';
import { fetchGithubDraft } from './githubCollection.js';
import { MISCELLANEOUS_COUNTRIES } from './newsSections.js';
import { dismissRejectedStory, pendingRejectedStories } from './rejectedReview.js';
import { viennaWallTimeToIso } from './viennaTime.js';
import { recordEditorialDecision } from './editorialLearning.js';

const initialPlacement = config => ({ sectionId: config.sections.find(section => section.id === 'Miscellaneous')?.id || config.sections[0]?.id || '', subsection: '', country: '', publishedAt: '' });

export default function RejectedStories({ config, setConfig, publishedArticles, onApprove }) {
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [placements, setPlacements] = useState({});
  const [message, setMessage] = useState('');
  async function refresh() {
    setLoading(true);
    setError('');
    try { setDraft(await fetchGithubDraft()); }
    catch (failure) { setError(failure.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);
  const pending = pendingRejectedStories(draft, config, publishedArticles);
  const updatePlacement = (id, patch) => setPlacements(current => ({ ...current, [id]: { ...initialPlacement(config), ...current[id], ...patch } }));
  async function approve(item, placement) {
    setBusyId(item.id);
    setError('');
    try {
      const parts = placement.publishedAt?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
      const publishedAt = parts ? viennaWallTimeToIso(...parts.slice(1).map(Number)) : item.publishedAt;
      await onApprove(item, { ...placement, publishedAt }, draft.checkedAt);
      setMessage(`Approved “${item.title}”. Saving for everyone…`);
    } catch (failure) { setError(failure.message); }
    finally { setBusyId(''); }
  }
  return <section className="rejected-review">
    <div className="rejected-review-header"><div><h3>Rejected stories</h3><p className="cms-help">Latest completed scrape. Open a headline to check the article before approving. Approval teaches similar future stories their placement; deletion teaches the collector to exclude repeats.</p></div><button type="button" className="cms-primary" onClick={refresh} disabled={loading}>Refresh</button></div>
    {loading && <p role="status">Loading rejected stories…</p>}
    {error && <p role="alert" className="rejected-review-error">{error}</p>}
    {message && <p role="status" className="cms-message">{message}</p>}
    {draft && <p className="cms-help">Scrape completed {new Date(draft.checkedAt).toLocaleString('en-GB', { timeZone: 'Europe/Vienna', dateStyle: 'medium', timeStyle: 'short' })} · {pending.length} awaiting review</p>}
    {draft && !pending.length && <p role="status">No rejected stories awaiting review.</p>}
    <div className="rejected-review-list">{pending.map(item => {
      const placement = { ...initialPlacement(config), ...placements[item.id] };
      const section = config.sections.find(entry => entry.id === placement.sectionId);
      const countries = [...new Set([...(MISCELLANEOUS_COUNTRIES[placement.subsection] || []), ...(config.customCountries?.[placement.subsection] || [])])];
      const valid = section?.visible && placement.subsection && section.subsections.includes(placement.subsection)
        && Number.isFinite(Date.parse(placement.publishedAt || item.publishedAt))
        && (section.id !== 'Miscellaneous' || !placement.country || countries.includes(placement.country));
      const href = /^https:\/\//i.test(item.url || '') ? item.url : '';
      return <article key={item.id} className="rejected-review-card">
        <button type="button" className="import-placement-delete" aria-label={`Delete story: ${item.title}`} title="Delete story from review" disabled={Boolean(busyId)} onClick={() => { setConfig(current => dismissRejectedStory(recordEditorialDecision(current, item, 'reject'), draft.checkedAt, item.id)); setMessage(`Deleted “${item.title}” from this review list. The collector will exclude close repeats.`); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v6m4-6v6"/></svg></button>
        <h4>{href ? <a href={href} target="_blank" rel="noopener noreferrer">{item.title}</a> : item.title}</h4>
        <p className="rejected-review-meta"><strong>{item.sourceName || 'Unknown agency'}</strong> · {item.reason || 'No reason recorded'}</p>
        <div className="cms-fields rejected-review-fields">
          <div className="rejected-review-selects">
            <label>Section<select value={placement.sectionId} onChange={event => updatePlacement(item.id, { sectionId: event.target.value, subsection: '', country: '' })}>{config.sections.filter(entry => entry.id !== 'Lead stories').map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
            <label>Subsection<select value={placement.subsection} onChange={event => updatePlacement(item.id, { subsection: event.target.value, country: '' })}><option value="">Choose subsection</option>{(section?.subsections || []).map(name => <option key={name} value={name}>{name}</option>)}</select></label>
            <label>{placement.subsection === 'INTERNATIONAL ORGANISATIONS' ? 'Organisation' : 'Country'}<select value={placement.country} onChange={event => updatePlacement(item.id, { country: event.target.value })} disabled={section?.id !== 'Miscellaneous' || !placement.subsection}><option value="">Directly under subsection</option>{countries.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
          </div>
          <div className="rejected-review-details"><label>Publication date and time<input type="datetime-local" value={placement.publishedAt || (Number.isFinite(Date.parse(item.publishedAt)) ? new Date(item.publishedAt).toLocaleString('sv-SE', { timeZone: 'Europe/Vienna' }).replace(' ', 'T').slice(0, 16) : '')} onChange={event => updatePlacement(item.id, { publishedAt: event.target.value })}/></label><button type="button" className="cms-primary" disabled={!valid || !href || Boolean(busyId)} onClick={() => approve(item, placement)}>Approve</button></div>
        </div>
      </article>;
    })}</div>
    {(config.editorialLearning || []).length > 0 && <details className="rejected-learned-rules"><summary>Learned decisions ({config.editorialLearning.length})</summary><p className="cms-help">Forget a decision to stop applying it to future scrapes. This does not remove an already published story.</p>{[...config.editorialLearning].reverse().map(rule => <div className="rejected-learned-rule" key={`${rule.url}-${rule.at}`}><span><strong>{rule.action === 'approve' ? 'Approved' : 'Excluded'}</strong> · {rule.sourceName || 'Unknown agency'} · {rule.title}{rule.action === 'approve' ? ` → ${rule.sectionId} / ${rule.subsection}${rule.country ? ` / ${rule.country}` : ''}` : ''}</span><button type="button" className="cms-danger" onClick={() => setConfig(current => ({ ...current, editorialLearning: current.editorialLearning.filter(item => item.url !== rule.url), rejectedReview: current.rejectedReview?.checkedAt === draft?.checkedAt ? { ...current.rejectedReview, deletedIds: current.rejectedReview.deletedIds.filter(id => !(draft?.editorialRejections || []).some(item => item.id === id && item.url === rule.url)) } : current.rejectedReview }))}>Forget rule</button></div>)}</details>}
  </section>;
}
