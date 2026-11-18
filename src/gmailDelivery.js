const runsApi = 'https://api.github.com/repos/Buddhuza/dnu/actions/workflows/send-dnu-gmail.yml/runs?branch=main&per_page=10';

export async function gmailDeliveryStatus(requestId, fetchImpl = fetch) {
  const response = await fetchImpl(runsApi, { cache: 'no-store', headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) return 'unknown';
  const run = (await response.json()).workflow_runs?.find(item => item.display_title === `Send DNU ${requestId}`);
  if (!run) return 'queued';
  return run.status === 'completed' ? run.conclusion === 'success' ? 'sent' : 'failed' : 'sending';
}

export async function waitForGmailDelivery(requestId, { fetchImpl = fetch, pause = ms => new Promise(resolve => setTimeout(resolve, ms)), attempts = 18 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const status = await gmailDeliveryStatus(requestId, fetchImpl).catch(() => 'unknown');
    if (status === 'sent' || status === 'failed') return status;
    await pause(10_000);
  }
  return 'unknown';
}
