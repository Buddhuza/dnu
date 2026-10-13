import React, { useMemo, useState } from 'react';
import { sourceCoverageRows } from './sourceCoverageRows.js';

export default function SourceCoverage({ sources, articles, outcomes, extraChecks, selectedId }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All without a selected story');
  const rows = useMemo(() => sourceCoverageRows(sources, articles, outcomes, extraChecks), [sources, articles, outcomes, extraChecks]);
  const without = rows.filter(row => !row.count);
  const notChecked = without.filter(row => row.status === 'Not checked').length;
  const failed = without.filter(row => row.status === 'Fetch failed').length;
  const listingOnly = without.filter(row => row.status === 'Listing only').length;
  const sampled = without.filter(row => row.status === 'Article pages sampled').length;
  const otherChecked = without.length - notChecked - failed - listingOnly - sampled;
  const predefinedSources = sources.filter(source => /^source-\d+$/.test(source.id));
  const checkedIds = new Set(outcomes.map(outcome => outcome.id));
  const fullSourcePass = predefinedSources.length > 0 && predefinedSources.every(source => checkedIds.has(source.id));
  const visible = rows.filter(row => (filter === 'All sources' || (filter === 'All without a selected story' ? !row.count : row.status === filter))
    && `${row.name} ${row.group || ''} ${row.url} ${row.reason}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="source-coverage" id="source-coverage" aria-labelledby="source-coverage-title">
    <h2 id="source-coverage-title">Websites without selected articles</h2>
    <p className="coverage-explanation">{fullSourcePass ? `A listing-page request was made for each of the ${predefinedSources.length} websites. “Listing only” means article links were found but their original pages were not checked. “Article pages sampled” means some original pages were checked but no headline from that site was selected. Neither status means the site had no relevant news.` : 'A website without a selected article may still have relevant news. The statuses below show how far the review got for each source.'}</p>
    <div className="coverage-counts"><span><strong>{rows.length - without.length}</strong> outlets with stories</span><span><strong>{sampled}</strong> article pages sampled, none selected</span><span><strong>{listingOnly}</strong> listing only, articles unreviewed</span><span><strong>{failed}</strong> listing fetch failed</span>{otherChecked > 0 && <span><strong>{otherChecked}</strong> other checks without selection</span>}{notChecked > 0 && <span><strong>{notChecked}</strong> not checked</span>}</div>
    <div className="coverage-controls"><input aria-label="Search source coverage" placeholder="Find a website or reason" value={search} onChange={event => setSearch(event.target.value)}/><select aria-label="Filter source coverage" value={filter} onChange={event => setFilter(event.target.value)}>{['All without a selected story', 'Listing only', 'Article pages sampled', 'Fetch failed', 'Not checked', 'Checked, no verified story', 'Checked, no story selected', 'All sources'].map(value => <option key={value}>{value}</option>)}</select></div>
    <div className="coverage-list">{visible.map(row => <article className={`coverage-row ${row.id === selectedId ? 'selected' : ''}`} key={row.id} id={`coverage-${row.id}`}><div><strong>{row.name}</strong><span>{row.group || 'Discovery source'} · {row.status}</span></div><p>{row.reason}</p><a href={row.url} target="_blank" rel="noopener noreferrer">{row.url}</a></article>)}{!visible.length && <p>No sources match this filter.</p>}</div>
  </section>;
}
