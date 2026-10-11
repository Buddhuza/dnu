export function currentDailyUpdate(snapshot, now = Date.now()) {
  const windowHours = snapshot.windowHours === 48 ? 48 : 24;
  const cutoff = now - windowHours * 60 * 60 * 1000;
  const articles = snapshot.articles.filter(item => {
    const time = Date.parse(item.publishedAt);
    return Number.isFinite(time) && time >= cutoff && time <= now + 5 * 60 * 1000;
  });
  const sourceIds = new Set(articles.map(item => item.sourceId));
  const sourceOutcomes = snapshot.sourceOutcomes.map(item => item.status === 'collected' && !sourceIds.has(item.id)
    ? { ...item, status: `no selected article remains in the current ${windowHours}-hour window` }
    : item);
  return { ...snapshot, articles, sourceOutcomes, servedAt: new Date(now).toISOString() };
}
