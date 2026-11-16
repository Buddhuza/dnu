export const completedNoticeMs = 45_000;

export function showScrapeNotice(status, { dialogOpen = false, dismissedRunId = '', now = Date.now() } = {}) {
  if (dialogOpen || !status) return false;
  if (status.state === 'running') return true;
  if (status.state !== 'complete' || String(status.runId || '') === String(dismissedRunId)) return false;
  const completedAt = Date.parse(status.updatedAt || status.checkedAt || '');
  return Number.isFinite(completedAt) && now >= completedAt && now - completedAt < completedNoticeMs;
}
