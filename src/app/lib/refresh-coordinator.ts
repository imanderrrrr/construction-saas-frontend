// A rejected credential and an unavailable server have different lifecycles.
import { getBaseUrl, getCsrfToken } from './api';
export type RefreshOutcome = 'ok' | 'rejected' | 'unreachable';
let refreshPromise: Promise<RefreshOutcome> | null = null;

export async function refreshSession(): Promise<RefreshOutcome> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = doRefresh();
  try { return await refreshPromise; } finally { refreshPromise = null; }
}
// Compatibility for callers which only need to know whether a token changed.
export async function refreshIfNeeded(): Promise<boolean> {
  return await refreshSession() === 'ok';
}
async function doRefresh(): Promise<RefreshOutcome> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${getBaseUrl()}/api/v1/auth/refresh`, {
      method: 'POST', credentials: 'include', body: '{}', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': getCsrfToken() ?? '' },
    });
    if (res.ok) return 'ok';
    return res.status === 401 || res.status === 403 ? 'rejected' : 'unreachable';
  } catch { return 'unreachable'; } finally { clearTimeout(timeoutId); }
}
