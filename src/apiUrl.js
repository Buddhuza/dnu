export function apiUrl(path) {
  if (!/^\/api\/[a-z0-9/-]+$/i.test(path)) throw new Error('Invalid DNU API path.');
  const configured = typeof window === 'undefined' ? '' : String(window.DNU_API_URL || '');
  const buildValue = import.meta.env?.VITE_DNU_API_URL || '';
  const raw = (configured || buildValue).trim().replace(/\/+$/, '');
  if (!raw) return path;
  const url = new URL(raw);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
    throw new Error('The DNU API must use HTTPS.');
  return `${url.origin}${path}`;
}
