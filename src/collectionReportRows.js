const statusLabels = {
  collected: 'Checked',
  checked: 'Checked',
  'listing-only': 'Listing only',
  sampled: 'Article pages sampled',
  'not-checked': 'Not checked'
};

export function collectionReportRows(sources, articles, outcomes = []) {
  const counts = new Map();
  for (const article of articles) if (article.sourceId) counts.set(article.sourceId, (counts.get(article.sourceId) || 0) + 1);
  const byId = new Map(outcomes.map(outcome => [outcome.id, outcome]));
  return sources.map(source => {
    const outcome = byId.get(source.id);
    const raw = outcome?.status || 'not-checked';
    const status = statusLabels[raw] || (/fail|error|unreadable/i.test(raw) ? 'Failed' : 'Checked, no verified story');
    return {
      id: source.id, name: source.name, url: source.url, status,
      reason: outcome?.reason || 'No collection check was recorded for this source.',
      stories: counts.get(source.id) || 0
    };
  });
}
