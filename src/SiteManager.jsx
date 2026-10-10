import React, { useMemo, useState } from 'react';
import { THEME_PRESETS, normalizeSiteConfig } from './siteConfig.js';
import './cms.css';

const tabs = ['Content', 'Sections', 'Stories', 'Theme', 'Save & share'];

export default function SiteManager({ config, setConfig, articles, onClose, onReset }) {
  const [tab, setTab] = useState('Content');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [newStory, setNewStory] = useState({ title: '', summary: '', sourceName: '', url: '', subsection: '', sectionId: config.sections[0]?.id || '', publishedAt: new Date().toISOString().slice(0, 16) });
  const allStories = useMemo(() => [
    ...articles.map(item => ({ ...item, sectionId: config.articleEdits[item.id]?.sectionId || item.section, custom: false })),
    ...config.customArticles.map(item => ({ ...item, custom: true }))
  ], [articles, config.articleEdits, config.customArticles]);
  const matchingStories = allStories.filter(item => `${item.title} ${item.sourceName} ${item.sectionId}`.toLowerCase().includes(search.toLowerCase()));

  const update = patch => setConfig(current => ({ ...current, ...patch }));
  const updateSection = (id, patch) => setConfig(current => ({ ...current, sections: current.sections.map(section => section.id === id ? { ...section, ...patch } : section) }));
  const moveSection = (index, direction) => setConfig(current => {
    const next = [...current.sections];
    const other = index + direction;
    if (other < 0 || other >= next.length) return current;
    [next[index], next[other]] = [next[other], next[index]];
    return { ...current, sections: next };
  });
  const editStory = (item, patch) => setConfig(current => {
    if (item.custom) return { ...current, customArticles: current.customArticles.map(story => story.id === item.id ? { ...story, ...patch } : story) };
    const previous = current.articleEdits[item.id] || { title: item.title, summary: item.summary, subsection: item.subsection || '', sectionId: item.sectionId, hidden: false };
    return { ...current, articleEdits: { ...current.articleEdits, [item.id]: { ...previous, ...patch } } };
  });
  const addSection = () => setConfig(current => ({ ...current, sections: [...current.sections, { id: `custom-section-${Date.now()}`, name: 'New section', visible: true }] }));
  const addStory = () => {
    let url;
    try { url = new URL(newStory.url); if (url.protocol !== 'https:') throw new Error(); } catch { setMessage('Enter a valid HTTPS article URL.'); return; }
    if (!newStory.title.trim() || !newStory.summary.trim() || !newStory.sourceName.trim()) { setMessage('Add a headline, summary, and agency name.'); return; }
    const publishedTime = Date.parse(newStory.publishedAt);
    if (!Number.isFinite(publishedTime)) { setMessage('Enter the article publication date and time.'); return; }
    const item = {
      id: `manual-${crypto.randomUUID()}`, url: url.href, sourceId: 'manual',
      sourceName: newStory.sourceName.trim(), title: newStory.title.trim(), summary: newStory.summary.trim(),
      subsection: newStory.subsection.trim(), sectionId: newStory.sectionId,
      publishedAt: new Date(publishedTime).toISOString(), hidden: false, reviewed: true
    };
    setConfig(current => ({ ...current, customArticles: [...current.customArticles, item] }));
    setNewStory(current => ({ ...current, title: '', summary: '', url: '' }));
    setMessage('Story added to the website.');
  };
  const downloadSettings = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'signal-desk-site-settings.json'; a.click();
    URL.revokeObjectURL(url);
  };
  const importSettings = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed?.version !== 1) throw new Error('This settings file has an unsupported version.');
      setConfig(normalizeSiteConfig(parsed, articles));
      setMessage('Settings imported and saved in this browser.');
    } catch (error) { setMessage(error.message || 'Could not read the settings file.'); }
    event.target.value = '';
  };

  return <div className="cms-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="cms-dialog" role="dialog" aria-modal="true" aria-labelledby="cms-title">
      <div className="cms-header"><div><span className="eyebrow">CONTENT MANAGEMENT</span><h2 id="cms-title">Manage site</h2><p>Changes appear immediately and are saved in this browser.</p></div><button className="cms-close" onClick={onClose} aria-label="Close content management">×</button></div>
      <div className="cms-layout"><nav className="cms-tabs" aria-label="Content management sections">{tabs.map(name => <button key={name} className={tab === name ? 'active' : ''} onClick={() => { setTab(name); setMessage(''); }}>{name}</button>)}</nav>
        <div className="cms-content">
          {tab === 'Content' && <div className="cms-fields"><h3>Website copy</h3><label>Site name<input value={config.brandName} onChange={e => update({ brandName: e.target.value })}/></label><label>Site tagline<input value={config.brandTagline} onChange={e => update({ brandTagline: e.target.value })}/></label><label>Hero eyebrow<input value={config.eyebrow} onChange={e => update({ eyebrow: e.target.value })}/></label><label>Hero headline<input value={config.heroTitle} onChange={e => update({ heroTitle: e.target.value })}/></label><label>Highlighted headline<input value={config.heroAccent} onChange={e => update({ heroAccent: e.target.value })}/></label><label>Hero description<textarea rows="3" value={config.heroDescription} onChange={e => update({ heroDescription: e.target.value })}/></label><label>News stream title<input value={config.updateTitle} onChange={e => update({ updateTitle: e.target.value })}/></label><label>Coverage note<textarea rows="3" value={config.coverageText} onChange={e => update({ coverageText: e.target.value })} placeholder="Leave empty to use the standard coverage note."/></label><label className="cms-check"><input type="checkbox" checked={config.showHero} onChange={e => update({ showHero: e.target.checked })}/> Show hero banner</label><label className="cms-check"><input type="checkbox" checked={config.showCoverage} onChange={e => update({ showCoverage: e.target.checked })}/> Show coverage note</label></div>}
          {tab === 'Sections' && <div><h3>News sections</h3><p className="cms-help">Rename and reorder sections, or hide one from the stream. Stories assigned to a hidden section remain saved.</p><div className="cms-section-list">{config.sections.map((section, index) => <div className="cms-section-row" key={section.id}><div className="cms-order"><button onClick={() => moveSection(index, -1)} disabled={index === 0} aria-label={`Move ${section.name} up`}>↑</button><button onClick={() => moveSection(index, 1)} disabled={index === config.sections.length - 1} aria-label={`Move ${section.name} down`}>↓</button></div><input aria-label={`Name for ${section.name}`} value={section.name} onChange={e => updateSection(section.id, { name: e.target.value })}/><label className="cms-check"><input type="checkbox" checked={section.visible} onChange={e => updateSection(section.id, { visible: e.target.checked })}/> Visible</label></div>)}</div><button className="cms-primary" onClick={addSection}>＋ Add section</button></div>}
          {tab === 'Stories' && <div><h3>Stories</h3><p className="cms-help">Edit the website text, move stories between sections, or hide them. Check article facts before publishing edits.</p><input className="cms-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a headline or agency" aria-label="Find a story"/><div className="cms-stories">{matchingStories.map(item => { const edit = item.custom ? item : config.articleEdits[item.id] || {}; return <details key={item.id} className="cms-story"><summary>{edit.hidden ? 'Hidden · ' : ''}{edit.title || item.title} <small>{item.sourceName}</small></summary><div className="cms-fields"><label>Exact headline<input value={edit.title ?? item.title} onChange={e => editStory(item, { title: e.target.value })}/></label><label>Factual follow-up sentence<textarea rows="3" value={edit.summary ?? item.summary} onChange={e => editStory(item, { summary: e.target.value })}/></label><label>Section<select value={edit.sectionId || item.sectionId} onChange={e => editStory(item, { sectionId: e.target.value })}>{config.sections.map(section => <option key={section.id} value={section.id}>{section.name}</option>)}</select></label><label>Country / topic<input value={edit.subsection ?? item.subsection ?? ''} onChange={e => editStory(item, { subsection: e.target.value })}/></label><label className="cms-check"><input type="checkbox" checked={!edit.hidden} onChange={e => editStory(item, { hidden: !e.target.checked })}/> Show in stream</label>{item.custom && <button className="cms-danger" onClick={() => setConfig(current => ({ ...current, customArticles: current.customArticles.filter(story => story.id !== item.id) }))}>Delete added story</button>}</div></details>; })}</div><h3>Add a story</h3><div className="cms-fields"><label>Exact headline<input value={newStory.title} onChange={e => setNewStory(current => ({ ...current, title: e.target.value }))}/></label><label>Factual follow-up sentence<textarea rows="3" value={newStory.summary} onChange={e => setNewStory(current => ({ ...current, summary: e.target.value }))}/></label><label>Agency name<input value={newStory.sourceName} onChange={e => setNewStory(current => ({ ...current, sourceName: e.target.value }))}/></label><label>Original article URL<input type="url" value={newStory.url} onChange={e => setNewStory(current => ({ ...current, url: e.target.value }))} placeholder="https://..."/></label><label>Published at<input type="datetime-local" value={newStory.publishedAt} onChange={e => setNewStory(current => ({ ...current, publishedAt: e.target.value }))}/></label><label>Section<select value={newStory.sectionId} onChange={e => setNewStory(current => ({ ...current, sectionId: e.target.value }))}>{config.sections.map(section => <option key={section.id} value={section.id}>{section.name}</option>)}</select></label><label>Country / topic<input value={newStory.subsection} onChange={e => setNewStory(current => ({ ...current, subsection: e.target.value }))}/></label><button className="cms-primary" onClick={addStory}>Add story</button></div></div>}
          {tab === 'Theme' && <div><h3>Theme</h3><p className="cms-help">Choose a starting palette, then adjust individual colors and the website font.</p><div className="cms-presets">{Object.entries(THEME_PRESETS).map(([id, preset]) => <button key={id} onClick={() => update({ theme: { ...preset } })}><span style={{ background: preset.primary, color: preset.accent }}>✳</span>{preset.name}</button>)}</div><div className="cms-color-grid">{[['primary','Main color'],['accent','Accent'],['background','Page background'],['surface','Cards'],['text','Text'],['section','Section headings']].map(([field,label]) => <label key={field}>{label}<span><input type="color" value={config.theme[field]} onChange={e => update({ theme: { ...config.theme, [field]: e.target.value } })}/><code>{config.theme[field]}</code></span></label>)}</div><label className="cms-font-label">Website font<select value={config.theme.font} onChange={e => update({ theme: { ...config.theme, font: e.target.value } })}><option>DM Sans</option><option>Manrope</option><option>Georgia</option></select></label><p className="cms-help">The Word report keeps the supplied example’s Calibri formatting.</p></div>}
          {tab === 'Save & share' && <div><h3>Save and move settings</h3><p className="cms-help">Edits save automatically in this browser. They do not change the public site for other visitors. Export a settings file to move your design to another browser. To publish it for everyone, replace data/site-config.json in the project with the exported file and redeploy the site.</p><div className="cms-actions"><button className="cms-primary" onClick={downloadSettings}>Download settings JSON</button><label className="cms-file">Import settings JSON<input type="file" accept="application/json,.json" onChange={importSettings}/></label><button className="cms-danger" onClick={() => { if (window.confirm('Restore the original website settings in this browser?')) { onReset(); setMessage('Original settings restored.'); } }}>Restore defaults</button></div></div>}
          {message && <p className="cms-message" role="status">{message}</p>}
        </div>
      </div>
    </section>
  </div>;
}
