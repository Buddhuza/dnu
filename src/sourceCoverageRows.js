const notCheckedReason = 'Not checked during this edition’s selective article review. No conclusion about this website’s coverage is implied.';

export function sourceCoverageRows(sources, articles, outcomes = [], extraChecks = []) {
  const counts = new Map();
  for (const article of articles) counts.set(article.sourceId, (counts.get(article.sourceId) || 0) + 1);
  const results = new Map(outcomes.map(item => [item.id, item]));
  const rows = sources.map(source => {
    const count = counts.get(source.id) || 0;
    const outcome = results.get(source.id);
    const status = count ? 'Included' : outcome?.status === 'collected' ? 'Checked, no story selected' : outcome ? 'Checked, no verified story' : 'Not checked';
    const reason = count ? `${count} verified ${count === 1 ? 'story' : 'stories'} included in this edition.`
      : outcome?.reason || (outcome?.status === 'collected' ? 'This source was checked, but no article was selected for this edition.' : outcome?.status || notCheckedReason);
    return { ...source, status, reason, count };
  });
  for (const check of extraChecks) if (!rows.some(row => row.id === check.id)) rows.push({ ...check, status: check.status || 'Checked, no verified story', count: 0 });
  return rows;
}
