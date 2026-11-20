export const completedNoticeMs = 45_000;

export function showScrapeNotice(status, { dialogOpen = false, dismissedRunId = '', hiddenBefore = 0, now = Date.now() } = {}) {
  if (dialogOpen || !status || status.runId != null && String(status.runId) === String(dismissedRunId)) return false;
  const statusAt = Date.parse(status.updatedAt || status.checkedAt || '');
  if (hiddenBefore && Number.isFinite(statusAt) && statusAt <= hiddenBefore) return false;
  if (status.state === 'running') return true;
  if (status.state !== 'complete' || String(status.runId || '') === String(dismissedRunId)) return false;
  const completedAt = statusAt;
  return Number.isFinite(completedAt) && now >= completedAt && now - completedAt < completedNoticeMs;
}
