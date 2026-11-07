import React, { useMemo, useState } from 'react';
import { collectionReportRows } from './collectionReportRows.js';

export default function CollectionReport({ sources, articles, outcomes, imported }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All sources');
  const rows = useMemo(() => collectionReportRows(sources, articles, outcomes), [sources, articles, outcomes]);
  const checked = rows.filter(row => row.status !== 'Not checked').length;
  const failed = rows.filter(row => row.status === 'Failed').length;
  const visible = rows.filter(row => (filter === 'All sources' || filter === row.status)
    && `${row.name} ${row.status} ${row.reason}`.toLowerCase().includes(search.toLowerCase()));

  return <section className="source-coverage collection-report" aria-labelledby="collection-report-title">
    <h2 id="collection-report-title">Collection report</h2>
    <p className="coverage-explanation">{checked} of {rows.length} listed sources have a recorded collection check; {failed} failed. Each row shows what was checked and why it did or did not contribute a visible story.</p>
    {imported && <p className="coverage-explanation">Spreadsheet imports add stories without checking source websites. Collection statuses below come from the last stored source scan.</p>}
    <div className="coverage-controls"><input aria-label="Search collection report" placeholder="Find a source or reason" value={search} onChange={event => setSearch(event.target.value)}/><select aria-label="Filter collection report" value={filter} onChange={event => setFilter(event.target.value)}>{['All sources', 'Not checked', 'Checked', 'Listing only', 'Article pages sampled', 'Failed', 'Checked, no verified story'].map(value => <option key={value}>{value}</option>)}</select></div>
    <div className="coverage-list">{visible.map(row => <article className="coverage-row" key={row.id}><div><strong>{row.name}</strong><span>{row.status}{row.stories ? ` · ${row.stories} in update` : ''}</span></div><p>{row.reason}</p><a href={row.url} target="_blank" rel="noopener noreferrer">{row.url}</a></article>)}{!visible.length && <p>No sources match this filter.</p>}</div>
  </section>;
}
