import React, { useEffect, useRef, useState } from 'react';
import { formatViennaDateTime, viennaWallTimeToIso } from './viennaTime.js';
import { MISCELLANEOUS_COUNTRIES, compareCountryLabels } from './newsSections.js';
import { blockedPlacementReason } from './sourcePolicy.js';
import { articlePlacement, publicArticleUrl } from '../server/importArticle.js';
import { duplicateGroups, duplicateGroupHue } from './storyDuplicates.js';
import { prepareManualArticle } from './manualArticle.js';
import { articleHintsFromUrl, articleHintsFromPage } from './urlArticleHints.js';
import { useEscapeToClose } from './useEscapeToClose.js';

const NEW = '__new__';

export default function AddArticlesDialog({ sections, sources = [], customCountries = {}, existingArticles = [], remainingSlots, onAdd, onClose }) {
  const [manual, setManual] = useState({ title: '', summary: '', sourceName: '', url: '', date: '', language: 'auto' });
  const [manualError, setManualError] = useState('');
  const [urlBusy, setUrlBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [addingId, setAddingId] = useState('');
  const [urlNotice, setUrlNotice] = useState('');
  const [drafts, setDrafts] = useState([]);
  const [completedEntries, setCompletedEntries] = useState(0);
  const dialogRef = useRef(null);
  const draftsRef = useRef(null);
  const availableSections = sections.filter(section => section.visible && section.id !== 'Lead stories');
  const duplicateMatches = duplicateGroups([...existingArticles, ...drafts.filter(draft => !draft.added)]);
  useEscapeToClose('add-dialog-title', onClose);

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

  async function addDraft(draft) {
    const section = availableSections.find(item => item.id === draft.sectionId);
    if (!section || !draft.subsection.trim() || (draft.sectionId === 'Lead stories' && draft.createSubsection) ||
      (!section.subsections.includes(draft.subsection) && !draft.createSubsection) ||
      (draft.sectionId === 'Miscellaneous' && !draft.country.trim()) ||
      remainingSlots < 1) return;
    const { added, russianSource, createSubsection, createCountry, fullBody, ...story } = draft;
    setAddingId(draft.id);
    try {
      await onAdd(story, { createSubsection, createCountry }, fullBody ? { url: story.url, heading: story.originalHeadline || story.title, body: fullBody, translated: story.translated } : null);
      changeDraft(draft.id, { added: true });
      setManualError('');
    } catch (error) { setManualError(error.message || 'Could not save this article.'); }
    finally { setAddingId(''); }
  }

  async function useArticleUrl() {
    const url = publicArticleUrl(manual.url.trim());
    if (!url) { setManualError('Enter a public HTTPS article URL first.'); return; }
    setManualError('');
    setUrlBusy(true);
    const fromUrl = articleHintsFromUrl(url.href, sources);
    let fromPage = {}, pageAvailable = false;
    try { fromPage = await articleHintsFromPage(url.href); pageAvailable = true; }
    catch { /* Most publishers block cross-origin browser requests; URL hints still work. */ }
    const title = fromPage.title || fromUrl.title;
    const sourceName = fromUrl.sourceName || fromPage.sourceName;
    const summary = fromPage.summary || '';
    const date = fromPage.date || fromUrl.date;
    setManual(current => current.url.trim() === url.href || current.url.trim() === manual.url.trim()
      ? { ...current, title: current.title || title, sourceName: current.sourceName || sourceName, summary: current.summary || summary, date: current.date || date }
      : current);
    setUrlNotice(pageAvailable ? 'Page metadata suggested. Verify the headline, text, agency and date before adding.'
      : title || sourceName || date ? 'Suggestions came from the URL; verify the exact headline and add text if needed.'
        : 'This URL does not reveal article details. Enter the headline, agency and text yourself.');
    setUrlBusy(false);
  }

  async function addManual(event) {
    event.preventDefault();
    const title = manual.title.trim(), text = manual.summary.trim();
    const sourceName = manual.sourceName.trim(), url = publicArticleUrl(manual.url.trim());
    if (!title || !sourceName || !url) { setManualError('Headline, agency and a public HTTPS hyperlink are required.'); return; }
    if (remainingSlots <= drafts.filter(draft => !draft.added).length) { setManualError('The update has reached its 100 added-story limit.'); return; }
    setPreparing(true);
    let prepared;
    try { prepared = await prepareManualArticle(title, text, manual.language); }
    catch (error) { setManualError(error.message || 'Could not translate this article.'); setPreparing(false); return; }
    const placement = articlePlacement({}, prepared.title, prepared.summary) || { sectionId: '', subsection: '', country: '' };
    const [year, month, day] = manual.date.split('-').map(Number);
    const publishedAt = manual.date ? viennaWallTimeToIso(year, month, day, 12) : null;
    setDrafts(current => [...current, { id: `manual-${crypto.randomUUID()}`, url: url.href, sourceId: 'manual', ingestMethod: 'add', manualOverride: true, sourceName, title: prepared.title, summary: prepared.summary, translated: prepared.translated, originalHeadline: prepared.originalHeadline, fullBody: prepared.body, publishedAt: publishedAt || new Date().toISOString(), timeSource: publishedAt ? 'inferred' : 'current', reviewed: true, hidden: false, russianSource: false, added: false, ...placement }]);
    setManual({ title: '', summary: '', sourceName: '', url: '', date: '', language: 'auto' });
    setManualError('');
    setUrlNotice('');
    setCompletedEntries(count => count + 1);
    setPreparing(false);
  }

  return <div className="add-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="add-dialog add-article-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="add-dialog-title">
      <div className="add-dialog-heading"><h2 id="add-dialog-title">Add article</h2><button type="button" onClick={onClose} aria-label="Close Add article">×</button></div>
      {remainingSlots < 1 && <p className="add-unavailable" role="status">The update has reached its 100 added-story limit. Remove an added story in Manage site → Stories before adding another.</p>}
      <form onSubmit={addManual}>
        <label htmlFor="add-link">Article URL</label>
        <div className="add-url-tools"><input id="add-link" type="url" value={manual.url} onChange={event => { setManual(current => ({ ...current, url: event.target.value })); setUrlNotice(''); }} placeholder="https://example.com/article" autoFocus/><button type="button" onClick={useArticleUrl} disabled={urlBusy || !manual.url.trim()}>{urlBusy ? 'Checking…' : 'Use URL'}</button></div>
        {urlNotice && <p className="add-url-notice" role="status">{urlNotice}</p>}
        <label htmlFor="add-headline">Headline</label><input id="add-headline" value={manual.title} maxLength="400" onChange={event => setManual(current => ({ ...current, title: event.target.value }))}/>
        <label htmlFor="add-summary">Text</label><textarea id="add-summary" rows="6" value={manual.summary} onChange={event => setManual(current => ({ ...current, summary: event.target.value }))}/>
        <label htmlFor="add-language">Article language</label><select id="add-language" value={manual.language} onChange={event => setManual(current => ({ ...current, language: event.target.value }))}><option value="auto">Detect automatically</option><option value="en">English</option><option value="ar">Arabic</option><option value="hy">Armenian</option><option value="az">Azerbaijani</option><option value="fr">French</option><option value="ka">Georgian</option><option value="de">German</option><option value="fa">Persian</option><option value="ro">Romanian</option><option value="ru">Russian</option><option value="sr">Serbian</option><option value="tr">Turkish</option><option value="uk">Ukrainian</option><option value="uz">Uzbek</option></select><p className="add-url-notice">Translation uses your browser when available; otherwise the pasted text is sent to a public translation service.</p>
        <label htmlFor="add-agency">Agency</label><input id="add-agency" value={manual.sourceName} maxLength="100" onChange={event => setManual(current => ({ ...current, sourceName: event.target.value }))}/>
        <label htmlFor="add-article-date">Article date in Vienna (optional)</label><input id="add-article-date" type="date" value={manual.date} onChange={event => setManual(current => ({ ...current, date: event.target.value }))}/><p className="add-url-notice">A date without a time is shown as 12:00 Vienna time.</p>
        {manualError && <p className="add-manual-error" role="alert">{manualError}</p>}
        <div className="add-dialog-actions"><button type="button" onClick={onClose}>Close</button><button type="submit" disabled={remainingSlots < 1 || urlBusy || preparing}>{preparing ? 'Preparing article…' : 'Choose placement'}</button></div>
      </form>
      {drafts.length > 0 && <div className="add-drafts" ref={draftsRef} aria-live="polite"><h3>Review placement</h3>{drafts.map(draft => {
        const section = availableSections.find(item => item.id === draft.sectionId);
        const subsections = section?.subsections || [];
        const countries = draft.sectionId === 'Miscellaneous' ? [...new Set([...(MISCELLANEOUS_COUNTRIES[draft.subsection] || []), ...(customCountries[draft.subsection] || [])])].sort((a, b) => compareCountryLabels(draft.subsection, a, b)) : [];
        const restriction = draft.manualOverride ? '' : blockedPlacementReason(draft);
        const valid = section && draft.subsection.trim() && (subsections.includes(draft.subsection) || (draft.createSubsection && draft.sectionId !== 'Lead stories')) && (draft.sectionId !== 'Miscellaneous' || (draft.country.trim() && (countries.includes(draft.country) || draft.createCountry))) && !restriction;
        return <div className="add-draft" key={draft.id}><strong>{draft.title}</strong><small>{draft.sourceName} · {formatViennaDateTime(draft.publishedAt)}</small><div className="add-placement">
          <label>Section<select value={draft.sectionId} onChange={event => changeDraft(draft.id, { sectionId: event.target.value, subsection: '', country: '', createSubsection: false, createCountry: false })} disabled={draft.added}><option value="">Choose section</option>{availableSections.filter(item => !draft.russianSource || item.id === 'Miscellaneous').map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>{draft.sectionId === 'Miscellaneous' ? 'Subsection' : draft.sectionId === 'Lead stories' ? 'Heading' : 'Country / topic'}<select value={draft.createSubsection ? NEW : draft.subsection} onChange={event => changeDraft(draft.id, { subsection: event.target.value === NEW ? '' : event.target.value, country: '', createSubsection: event.target.value === NEW, createCountry: false })} disabled={draft.added || !section}><option value="">Choose location</option>{subsections.filter(name => !draft.russianSource || name === 'RUSSIA / EURASIA').map(name => <option key={name} value={name}>{name}</option>)}{draft.sectionId !== 'Lead stories' && !draft.russianSource && <option value={NEW}>Create {draft.sectionId === 'Miscellaneous' ? 'subsection' : 'country or heading'}…</option>}</select></label>
          {draft.createSubsection && <label>New {draft.sectionId === 'Miscellaneous' ? 'subsection' : 'country or heading'}<input value={draft.subsection} maxLength={100} onChange={event => changeDraft(draft.id, { subsection: event.target.value })} disabled={draft.added} placeholder="Enter a name"/></label>}
          {draft.sectionId === 'Miscellaneous' && draft.subsection && <><label>{draft.subsection === 'INTERNATIONAL ORGANISATIONS' ? 'Organisation' : 'Country / organisation'}<select value={draft.createCountry ? NEW : draft.country} onChange={event => changeDraft(draft.id, { country: event.target.value === NEW ? '' : event.target.value, createCountry: event.target.value === NEW })} disabled={draft.added}><option value="">Choose country or organisation</option>{countries.map(name => <option key={name} value={name}>{name}</option>)}<option value={NEW}>Create country or organisation…</option></select></label>{draft.createCountry && <label>New country or organisation<input value={draft.country} maxLength={100} onChange={event => changeDraft(draft.id, { country: event.target.value })} disabled={draft.added} placeholder="Enter a name"/></label>}</>}
        </div>{!draft.added && duplicateMatches.has(draft.id) && <p className="add-duplicate-warning" style={{ '--duplicate-hue': duplicateGroupHue(duplicateMatches.get(draft.id).number) }}>Possible duplicate · Group {duplicateMatches.get(draft.id).number}: {duplicateMatches.get(draft.id).matches.map(other => `${other.sourceName}: ${other.title}`).join('; ')}</p>}{restriction && <p className="add-unavailable">{restriction}. Choose another relevant placement for this source.</p>}<button type="button" onClick={() => addDraft(draft)} disabled={draft.added || !valid || remainingSlots < 1 || addingId === draft.id}>{draft.added ? 'Added to update' : addingId === draft.id ? 'Saving…' : 'Add to update'}</button></div>;
      })}</div>}
    </section>
  </div>;
}
