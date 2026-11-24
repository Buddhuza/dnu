import React, { useState } from 'react';
import { useEscapeToClose } from './useEscapeToClose.js';
import AddressBook from './AddressBook.jsx';
import ScrapeLog from './ScrapeLog.jsx';
import RejectedStories from './RejectedStories.jsx';
import PersonalTheme from './PersonalTheme.jsx';
import { EditorAccountForm } from './EditorAccountDialog.jsx';
import './cms.css';

export const ownerTabs = ['Scope', 'Theme'];
export const sharedTabs = ['Collect', 'Rejected', 'Sources', 'Address book', 'Account'];
const tabs = ['Scope', 'Collect', 'Rejected', 'Sources', 'Theme', 'Address book', 'Account'];
const personalTabs = new Set(['Theme', 'Account']);

export default function SiteManager({ initialTab = 'Scope', isOwner = false, collectionPanel, config, setConfig, articles, baseSources, accountProfile, appearanceConfig, onAppearanceChange, onAppearanceReset, onApproveRejected, onRecipientsChange, onClose }) {
  useEscapeToClose('cms-title', onClose);
  const availableTabs = isOwner ? tabs : sharedTabs;
  const [tab, setTab] = useState(availableTabs.includes(initialTab) ? initialTab : availableTabs[0]);
  const [sourceSearch, setSourceSearch] = useState('');
  const [message, setMessage] = useState('');
  const [newSource, setNewSource] = useState({ name: '', group: 'Custom', url: '' });
  const update = patch => setConfig(current => ({ ...current, ...patch }));
  const addSource = () => {
    let url;
    try { url = new URL(newSource.url); if (url.protocol !== 'https:' || !url.hostname.includes('.')) throw new Error(); } catch { setMessage('Enter a valid public HTTPS source URL.'); return; }
    if (!newSource.name.trim()) { setMessage('Enter a source name.'); return; }
    const item = { id: `manual-source-${crypto.randomUUID()}`, name: newSource.name.trim(), group: newSource.group.trim() || 'Custom', url: url.href };
    setConfig(current => ({ ...current, customSources: [...current.customSources, item] }));
    setNewSource({ name: '', group: 'Custom', url: '' });
    setMessage('Source added. It now appears in the source list.');
  };
  const toggleSource = id => setConfig(current => ({ ...current, hiddenSourceIds: current.hiddenSourceIds.includes(id) ? current.hiddenSourceIds.filter(item => item !== id) : [...current.hiddenSourceIds, id] }));
  return <div className="cms-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="cms-dialog" role="dialog" aria-modal="true" aria-labelledby="cms-title">
      <div className="cms-header"><div><span className="eyebrow">SITE SETTINGS</span><h2 id="cms-title">Manage site</h2><p>Shared tabs save for everyone. Theme and Account follow your login.</p></div><button className="cms-close" onClick={onClose} aria-label="Close content management">×</button></div>
      <div className="cms-layout"><nav className="cms-tabs" aria-label="Content management sections">{availableTabs.map(name => <button key={name} className={tab === name ? 'active' : ''} onClick={() => { setTab(name); setMessage(''); }}><span>{name}</span><small className="cms-tab-scope">{personalTabs.has(name) ? 'Only me' : 'Shared'}</small></button>)}</nav>
        <div className="cms-content">
          {tab === 'Scope' && isOwner && <div><h3>Coverage keywords</h3><p className="cms-help">Only the owner can edit these shared editorial rules. The native collector applies its configured rules to completed JSON.</p><div className="cms-fields"><label>Include keywords<textarea rows="4" value={config.scopeInclude} onChange={e => update({ scopeInclude: e.target.value })} placeholder="security, politics, election"/></label><label>Exclude keywords<textarea rows="4" value={config.scopeExclude} onChange={e => update({ scopeExclude: e.target.value })} placeholder="sports, entertainment, opinion"/></label></div></div>}
          {tab === 'Collect' && <>{collectionPanel}<ScrapeLog/></>}
          {tab === 'Rejected' && <RejectedStories config={config} setConfig={setConfig} publishedArticles={articles} onApprove={onApproveRejected}/>}
          {tab === 'Address book' && <AddressBook onSelectedChange={onRecipientsChange}/>}
          {tab === 'Account' && accountProfile && <EditorAccountForm profile={accountProfile}/>}
          {tab === 'Sources' && <div><h3>News sources</h3><p className="cms-help">Add a website to the source list. In the full app, the Node collector checks publisher feeds, pages and discovery feeds. A static site cannot start collection without the server.</p><h3>Add source</h3><div className="cms-fields"><label>Source name<input value={newSource.name} onChange={e => setNewSource(current => ({ ...current, name: e.target.value }))}/></label><label>Region or category<input value={newSource.group} onChange={e => setNewSource(current => ({ ...current, group: e.target.value }))}/></label><label>News page URL<input type="url" value={newSource.url} onChange={e => setNewSource(current => ({ ...current, url: e.target.value }))} placeholder="https://example.com/news/"/></label><button className="cms-primary" onClick={addSource}>＋ Add news source</button></div><h3>My sources ({config.customSources.length})</h3><div className="cms-source-list">{config.customSources.map(item => <div className="cms-custom-source" key={item.id}><input aria-label={`Name of ${item.name}`} value={item.name} onChange={e => setConfig(current => ({ ...current, customSources: current.customSources.map(source => source.id === item.id ? { ...source, name: e.target.value } : source) }))}/><input aria-label={`Group for ${item.name}`} value={item.group} onChange={e => setConfig(current => ({ ...current, customSources: current.customSources.map(source => source.id === item.id ? { ...source, group: e.target.value } : source) }))}/><input aria-label={`URL for ${item.name}`} type="url" value={item.url} onChange={e => setConfig(current => ({ ...current, customSources: current.customSources.map(source => source.id === item.id ? { ...source, url: e.target.value } : source) }))}/><button className="cms-danger" onClick={() => setConfig(current => ({ ...current, customSources: current.customSources.filter(source => source.id !== item.id) }))}>Remove</button></div>)}</div><h3>Provided sources</h3><input className="cms-search" value={sourceSearch} onChange={e => setSourceSearch(e.target.value)} placeholder="Search provided sources" aria-label="Search provided sources"/><div className="cms-source-list">{baseSources.filter(item => `${item.name} ${item.group}`.toLowerCase().includes(sourceSearch.toLowerCase())).map(item => <label className="cms-source-row" key={item.id}><input type="checkbox" checked={!config.hiddenSourceIds.includes(item.id)} onChange={() => toggleSource(item.id)}/><span>{item.name}<small>{item.group}</small></span></label>)}</div></div>}
          {tab === 'Sources' && <div><h3>Collection pages for provided sources</h3><p className="cms-help">Collection page changes must be added to the source catalogue before running the Node collector.</p><div className="cms-fields">{baseSources.filter(item => `${item.name} ${item.group}`.toLowerCase().includes(sourceSearch.toLowerCase())).map(item => <label key={`listing-${item.id}`}>{item.name} collection page<input type="url" value={config.sourceListingOverrides?.[item.id] ?? ''} placeholder={item.listingUrl || item.url} onChange={event => setConfig(current => ({ ...current, sourceListingOverrides: { ...current.sourceListingOverrides, [item.id]: event.target.value } }))}/></label>)}</div></div>}
          {tab === 'Theme' && <PersonalTheme config={appearanceConfig} onChange={onAppearanceChange} onReset={onAppearanceReset}/>}
          {message && <p className="cms-message" role="status">{message}</p>}
        </div>
      </div>
    </section>
  </div>;
}
