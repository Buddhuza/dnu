import React, { useEffect, useState } from 'react';
import './editorialPolicy.css';

const policyUrl = `${import.meta.env.BASE_URL}editorial-policy.md`;

function policySections(markdown) {
  const sections = [];
  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith('# ')) sections.push({ heading: line.slice(2), items: [], introduction: true });
    else if (line.startsWith('## ')) sections.push({ heading: line.slice(3), items: [] });
    else if (line.startsWith('- ')) sections.at(-1)?.items.push({ text: line.slice(2), list: true });
    else if (line.trim()) sections.at(-1)?.items.push({ text: line, list: false });
  }
  return sections;
}

export default function EditorialPolicy({ onClose }) {
  const [markdown, setMarkdown] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(policyUrl, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`Could not load the policy (${response.status}).`);
        return response.text();
      })
      .then(text => {
        if (!text.startsWith('# Daily News Update:')) throw new Error('The policy document is unavailable.');
        setMarkdown(text);
      })
      .catch(cause => { if (cause.name !== 'AbortError') setError(cause.message); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const onKeyDown = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const copyPolicy = async () => {
    try { await navigator.clipboard.writeText(markdown); setCopied(true); }
    catch { setError('Clipboard access failed. Open the document to copy it manually.'); }
  };

  return <div className="policy-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="policy-dialog" role="dialog" aria-modal="true" aria-labelledby="policy-title">
      <header className="policy-header"><div><span className="eyebrow">SITUATION ROOM</span><h2 id="policy-title">Editorial policy</h2></div><button type="button" className="policy-close" onClick={onClose} aria-label="Close editorial policy">×</button></header>
      <div className="policy-actions"><button type="button" disabled={!markdown} onClick={copyPolicy}>{copied ? 'Copied' : 'Copy policy for another chat'}</button><a href={policyUrl} target="_blank" rel="noopener noreferrer">Open source document ↗</a></div>
      <div className="policy-content">{error && <p role="alert">{error}</p>}{!markdown && !error && <p>Loading policy…</p>}{policySections(markdown).map((section, index) => <section key={section.heading} className="policy-section"><h3>{section.heading}</h3>{section.introduction ? section.items.map((item, itemIndex) => <p key={itemIndex}>{item.text}</p>) : <ul>{section.items.map((item, itemIndex) => <li key={itemIndex}>{item.text}</li>)}</ul>}</section>)}</div>
    </section>
  </div>;
}
