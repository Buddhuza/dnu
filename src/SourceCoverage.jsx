import React, { useMemo, useState } from 'react';
import { sourceCoverageRows } from './sourceCoverageRows.js';

export default function SourceCoverage({ sources, articles, outcomes, extraChecks, selectedId }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All without a selected story');
  const rows = useMemo(() => sourceCoverageRows(sources, articles, outcomes, extraChecks), [sources, articles, outcomes, extraChecks]);
  const without = rows.filter(row => !row.count);
  const notChecked = without.filter(row => row.status === 'Not checked').length;
  const failed = without.filter(row => row.status === 'Fetch failed').length;
  const checked = without.length - notChecked - failed;
  const predefinedSources = sources.filter(source => /^source-\d+$/.test(source.id));
  const checkedIds = new Set(outcomes.map(outcome => outcome.id));
  const fullSourcePass = predefinedSources.length > 0 && predefinedSources.every(source => checkedIds.has(source.id));
  const visible = rows.filter(row => (filter === 'All sources' || (filter === 'All without a selected story' ? !row.count : row.status === filter))
    && `${row.name} ${row.group || ''} ${row.url} ${row.reason}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="source-coverage" id="source-coverage" aria-labelledby="source-coverage-title">
    <h2 id="source-coverage-title">Websites without selected articles</h2>
    <p className="coverage-explanation">{fullSourcePass ? `A source-by-source attempt covered all ${predefinedSources.length} listed websites. Publication times were checked on the original pages of selected articles. A site with no selected story may still have relevant coverage; the reasons below describe what this check established.` : 'This is a selected report. A missing website does not mean it published no relevant news. The statuses below distinguish websites checked without a selected story from websites not checked during this edition.'}</p>
    <div className="coverage-counts"><span><strong>{rows.length - without.length}</strong> outlets with stories</span><span><strong>{checked}</strong> checked without a story</span><span><strong>{failed}</strong> fetch failed</span><span><strong>{notChecked}</strong> not checked</span></div>
    <div className="coverage-controls"><input aria-label="Search source coverage" placeholder="Find a website or reason" value={search} onChange={event => setSearch(event.target.value)}/><select aria-label="Filter source coverage" value={filter} onChange={event => setFilter(event.target.value)}>{['All without a selected story', 'Not checked', 'Fetch failed', 'Checked, no verified story', 'Checked, no story selected', 'All sources'].map(value => <option key={value}>{value}</option>)}</select></div>
    <div className="coverage-list">{visible.map(row => <article className={`coverage-row ${row.id === selectedId ? 'selected' : ''}`} key={row.id} id={`coverage-${row.id}`}><div><strong>{row.name}</strong><span>{row.group || 'Discovery source'} · {row.status}</span></div><p>{row.reason}</p><a href={row.url} target="_blank" rel="noopener noreferrer">{row.url}</a></article>)}{!visible.length && <p>No sources match this filter.</p>}</div>
  </section>;
}
