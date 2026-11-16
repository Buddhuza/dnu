export function estimatedRunSeconds(runs, fallback = 180) {
  const seconds = (runs || [])
    .filter(run => run.status === 'completed' && run.conclusion === 'success')
    .map(run => (Date.parse(run.updated_at) - Date.parse(run.run_started_at || run.created_at)) / 1000)
    .filter(value => Number.isFinite(value) && value >= 30 && value <= 3600)
    .sort((a, b) => a - b);
  if (!seconds.length) return fallback;
  return Math.round(seconds[Math.floor(seconds.length / 2)]);
}

export function progressEstimate(status, now = Date.now()) {
  if (status?.state === 'complete') return { percent: 100, remainingSeconds: 0, overrun: false };
  if (status?.state !== 'running') return null;
  const started = Date.parse(status.startedAt || status.createdAt || '');
  const duration = Math.max(30, Number(status.estimatedDurationSeconds) || 180);
  if (!Number.isFinite(started)) return { percent: 0, remainingSeconds: duration, overrun: false };
  const elapsed = Math.max(0, Math.floor((now - started) / 1000));
  return {
    percent: Math.min(95, Math.round(elapsed / duration * 100)),
    remainingSeconds: Math.max(0, duration - elapsed),
    overrun: elapsed > duration
  };
}

export function formatCountdown(seconds) {
  const time = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`;
}
