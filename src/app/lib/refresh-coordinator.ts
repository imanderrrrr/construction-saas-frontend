// OFJR Construction — JWT Refresh Coordinator
// Ensures only ONE refresh request is in flight at a time.
// Multiple concurrent 401s all wait on the same Promise.
// The browser sends the HttpOnly refresh cookie automatically.

import { getBaseUrl } from './api';

let refreshPromise: Promise<boolean> | null = null;

export async function refreshIfNeeded(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = doRefresh();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function doRefresh(): Promise<boolean> {
  try {
    // Use fetch directly — NEVER go through api() to avoid infinite loops.
    // The HttpOnly cookie `ofjr_rt` is sent automatically via credentials: 'include'.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${getBaseUrl()}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: '{}',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    return res.ok;
  } catch {
    return false;
  }
}
