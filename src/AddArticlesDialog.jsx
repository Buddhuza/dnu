import React, { useEffect, useRef, useState } from 'react';
import { formatViennaDateTime } from './viennaTime.js';
import { MISCELLANEOUS_COUNTRIES, compareCountryLabels } from './newsSections.js';
import { canonicalArticleUrl } from './siteConfig.js';
import { blockedPlacementReason, directGovernmentPublicationReason } from './sourcePolicy.js';
import { articlePlacement, publicArticleUrl } from '../server/importArticle.js';
import { duplicateGroups, duplicateGroupHue } from './storyDuplicates.js';
import { excludedHeadlineReason } from './headlinePolicy.js';

const NEW = '__new__';

export default function AddArticlesDialog({ sections, customCountries = {}, existingArticles = [], existingUrls, remainingSlots, onAdd, onClose }) {
  const [manual, setManual] = useState({ title: '', summary: '', sourceName: '', url: '' });
  const [manualError, setManualError] = useState('');
  const [drafts, setDrafts] = useState([]);
  const [completedEntries, setCompletedEntries] = useState(0);
  const dialogRef = useRef(null);
  const draftsRef = useRef(null);
  const availableSections = sections.filter(section => section.visible && section.id !== 'Lead stories');
  const duplicateMatches = duplicateGroups([...existingArticles, ...drafts.filter(draft => !draft.added)]);

  useEffect(() => {
    if (!completedEntries) return;
    const frame = requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      const target = draftsRef.current;
      if (!dialog || !target) return;
      const top = dialog.scrollTop + target.getBoundingClientRect().top - dialog.getBoundingClientRect().top - 18;
      dialog.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [completedEntries]);

  function changeDraft(id, change) {
    setDrafts(current => current.map(draft => draft.id === id ? { ...draft, ...change } : draft));
  }

  function addDraft(draft) {
    const section = availableSections.find(item => item.id === draft.sectionId);
    if (!section || !draft.subsection.trim() || (draft.sectionId === 'Lead stories' && draft.createSubsection) ||
      (!section.subsections.includes(draft.subsection) && !draft.createSubsection) ||
      (draft.sectionId === 'Miscellaneous' && !draft.country.trim()) ||
      (draft.russianSource && (draft.sectionId !== 'Miscellaneous' || draft.subsection !== 'RUSSIA / EURASIA')) || blockedPlacementReason(draft) || remainingSlots < 1) return;
    const { added, russianSource, createSubsection, createCountry, ...story } = draft;
    onAdd(story, { createSubsection, createCountry });
    changeDraft(draft.id, { added: true });
  }

  function addManual(event) {
    event.preventDefault();
    const title = manual.title.trim(), summary = manual.summary.trim();
    const sourceName = manual.sourceName.trim(), url = publicArticleUrl(manual.url.trim());
    if (!title || !sourceName || !url) { setManualError('Headline, agency and a public HTTPS hyperlink are required.'); return; }
    if (directGovernmentPublicationReason({ sourceName, url: url.href })) { setManualError('Direct government publications are excluded from the update.'); return; }
    if (excludedHeadlineReason(title, summary, url.href)) { setManualError(excludedHeadlineReason(title, summary, url.href)); return; }
    if ([...existingUrls, ...drafts.map(draft => draft.url)].some(value => canonicalArticleUrl(value) === canonicalArticleUrl(url.href))) { setManualError('This article link is already in the update or review list.'); return; }
    if (remainingSlots <= drafts.filter(draft => !draft.added).length) { setManualError('The update has reached its 100 added-story limit.'); return; }
    const placement = articlePlacement({}, title, summary) || { sectionId: '', subsection: '', country: '' };
    setDrafts(current => [...current, { id: `manual-${url.href}`, url: url.href, sourceId: 'manual', sourceName, title, summary, publishedAt: new Date().toISOString(), timeSource: 'current', reviewed: true, hidden: false, russianSource: false, added: false, ...placement }]);
    setManual({ title: '', summary: '', sourceName: '', url: '' });
    setManualError('');
    setCompletedEntries(count => count + 1);
  }

  return <div className="add-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="add-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="add-dialog-title">
      <div className="add-dialog-heading"><h2 id="add-dialog-title">Add article</h2><button type="button" onClick={onClose} aria-label="Close Add article">×</button></div>
      {remainingSlots < 1 && <p className="add-unavailable" role="status">The update has reached its 100 added-story limit. Remove an added story in Manage site → Stories before adding another.</p>}
      <form onSubmit={addManual}><label htmlFor="add-headline">Headline</label><input id="add-headline" value={manual.title} maxLength="400" onChange={event => setManual(current => ({ ...current, title: event.target.value }))} autoFocus/><label htmlFor="add-summary">Summary</label><textarea id="add-summary" rows="3" value={manual.summary} maxLength="1200" onChange={event => setManual(current => ({ ...current, summary: event.target.value }))}/><label htmlFor="add-agency">Agency</label><input id="add-agency" value={manual.sourceName} maxLength="100" onChange={event => setManual(current => ({ ...current, sourceName: event.target.value }))}/><label htmlFor="add-link">Hyperlink</label><input id="add-link" type="url" value={manual.url} onChange={event => setManual(current => ({ ...current, url: event.target.value }))} placeholder="https://example.com/article"/>{manualError && <p className="add-manual-error" role="alert">{manualError}</p>}<div className="add-dialog-actions"><button type="button" onClick={onClose}>Close</button><button type="submit" disabled={remainingSlots < 1}>Choose placement</button></div></form>
      {drafts.length > 0 && <div className="add-drafts" ref={draftsRef} aria-live="polite"><h3>Review placement</h3>{drafts.map(draft => {
        const section = availableSections.find(item => item.id === draft.sectionId);
        const subsections = section?.subsections || [];
        const countries = draft.sectionId === 'Miscellaneous' ? [...new Set([...(MISCELLANEOUS_COUNTRIES[draft.subsection] || []), ...(customCountries[draft.subsection] || [])])].sort((a, b) => compareCountryLabels(draft.subsection, a, b)) : [];
        const restriction = blockedPlacementReason(draft);
        const valid = section && draft.subsection.trim() && (subsections.includes(draft.subsection) || (draft.createSubsection && draft.sectionId !== 'Lead stories')) && (draft.sectionId !== 'Miscellaneous' || (draft.country.trim() && (countries.includes(draft.country) || draft.createCountry))) && (!draft.russianSource || (draft.sectionId === 'Miscellaneous' && draft.subsection === 'RUSSIA / EURASIA')) && !restriction;
        return <div className="add-draft" key={draft.id}><strong>{draft.title}</strong><small>{draft.sourceName} · {formatViennaDateTime(draft.publishedAt)}</small><div className="add-placement">
          <label>Section<select value={draft.sectionId} onChange={event => changeDraft(draft.id, { sectionId: event.target.value, subsection: '', country: '', createSubsection: false, createCountry: false })} disabled={draft.added}><option value="">Choose section</option>{availableSections.filter(item => !draft.russianSource || item.id === 'Miscellaneous').map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>{draft.sectionId === 'Miscellaneous' ? 'Subsection' : draft.sectionId === 'Lead stories' ? 'Heading' : 'Country / topic'}<select value={draft.createSubsection ? NEW : draft.subsection} onChange={event => changeDraft(draft.id, { subsection: event.target.value === NEW ? '' : event.target.value, country: '', createSubsection: event.target.value === NEW, createCountry: false })} disabled={draft.added || !section}><option value="">Choose location</option>{subsections.filter(name => !draft.russianSource || name === 'RUSSIA / EURASIA').map(name => <option key={name} value={name}>{name}</option>)}{draft.sectionId !== 'Lead stories' && !draft.russianSource && <option value={NEW}>Create {draft.sectionId === 'Miscellaneous' ? 'subsection' : 'country or heading'}…</option>}</select></label>
          {draft.createSubsection && <label>New {draft.sectionId === 'Miscellaneous' ? 'subsection' : 'country or heading'}<input value={draft.subsection} maxLength={100} onChange={event => changeDraft(draft.id, { subsection: event.target.value })} disabled={draft.added} placeholder="Enter a name"/></label>}
          {draft.sectionId === 'Miscellaneous' && draft.subsection && <><label>{draft.subsection === 'INTERNATIONAL ORGANISATIONS' ? 'Organisation' : 'Country / organisation'}<select value={draft.createCountry ? NEW : draft.country} onChange={event => changeDraft(draft.id, { country: event.target.value === NEW ? '' : event.target.value, createCountry: event.target.value === NEW })} disabled={draft.added}><option value="">Choose country or organisation</option>{countries.map(name => <option key={name} value={name}>{name}</option>)}<option value={NEW}>Create country or organisation…</option></select></label>{draft.createCountry && <label>New country or organisation<input value={draft.country} maxLength={100} onChange={event => changeDraft(draft.id, { country: event.target.value })} disabled={draft.added} placeholder="Enter a name"/></label>}</>}
        </div>{!draft.added && duplicateMatches.has(draft.id) && <p className="add-duplicate-warning" style={{ '--duplicate-hue': duplicateGroupHue(duplicateMatches.get(draft.id).number) }}>Possible duplicate · Group {duplicateMatches.get(draft.id).number}: {duplicateMatches.get(draft.id).matches.map(other => `${other.sourceName}: ${other.title}`).join('; ')}</p>}{restriction && <p className="add-unavailable">{restriction}. Choose another relevant placement for this source.</p>}<button type="button" onClick={() => addDraft(draft)} disabled={draft.added || !valid || remainingSlots < 1}>{draft.added ? 'Added to update' : 'Add to update'}</button></div>;
      })}</div>}
    </section>
  </div>;
}
