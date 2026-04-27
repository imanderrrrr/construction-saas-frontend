// OFJR Construction — HTTP API Client
// Single fetch wrapper: baseURL from env, HttpOnly cookie auth, CSRF protection.

import { refreshIfNeeded } from './refresh-coordinator';
import i18n from '../../i18n';

// In production (Vercel) we MUST use relative paths so requests go through
// the Vercel rewrite proxy, keeping cookies same-origin.
// VITE_API_URL is only used in local development.
const BASE_URL = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL ?? '');

export function getBaseUrl(): string {
  return BASE_URL;
}

// ── Cleanup legacy localStorage keys (pre-cookie auth) ─────────────────────
// These were used before the HttpOnly cookie migration. Remove them so
// sensitive tokens are no longer sitting in localStorage.
const LEGACY_KEYS = ['ofjr_access_token', 'ofjr_refresh_token', 'ofjr_user_role', 'ofjr_username'];
LEGACY_KEYS.forEach(k => localStorage.removeItem(k));

// ── Cookie-based session helpers ────────────────────────────────────────────

/** Parse the non-HttpOnly `ofjr_session` cookie (set by the server). */
export function getSessionMeta(): { role: string; username: string } | null {
  const match = document.cookie.match(/ofjr_session=([^;]+)/);
  if (!match) return null;
  try { return JSON.parse(decodeURIComponent(match[1])); } catch { return null; }
}

export function getStoredRole(): string | null { return getSessionMeta()?.role ?? null; }
export function getStoredUsername(): string | null { return getSessionMeta()?.username ?? null; }
export function isAuthenticated(): boolean { return getSessionMeta() !== null; }

/** Clear the client-readable session cookie (HttpOnly cookies are cleared by the server). */
export function clearSessionCookie(): void {
  document.cookie = 'ofjr_session=; Path=/; Max-Age=0';
}

/**
 * Read the long-lived `bt_tenant` cookie set by the backend after a
 * successful login or signup. Used by the Login page to pre-fill the
 * workspace identifier so returning users don't have to retype it.
 *
 * Returns null if the cookie is missing, empty, or malformed (first-time
 * visitors, customers of the legacy default tenant who never typed a slug,
 * a corrupt percent-encoding, etc.). Never throws — Login.tsx mounts on
 * the unauthenticated path so any failure here would block sign-in.
 */
export function getStoredTenantSlug(): string | null {
  // Anchored on cookie boundary (start-of-string OR semicolon) so we never
  // match a cookie whose name ends in "bt_tenant" (e.g. "evil_bt_tenant").
  const match = document.cookie.match(/(?:^|;\s*)bt_tenant=([^;]+)/);
  if (!match) return null;
  try {
    const decoded = decodeURIComponent(match[1]).trim();
    return decoded.length > 0 ? decoded : null;
  } catch {
    // decodeURIComponent throws on malformed % sequences. Treat as missing.
    return null;
  }
}

// ── CSRF ────────────────────────────────────────────────────────────────────

function getCsrfToken(): string | null {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export { getCsrfToken };

// ── Custom API error ────────────────────────────────────────────────────────

export class ApiError extends Error {
  /** Domain error code from the backend (e.g. "BUDGET_EXCEEDED", "NOT_ASSIGNED"). */
  public code?: string;
  /** Field-level validation details from backend (e.g. { username: "must be 3-50 characters" }) */
  public details?: Record<string, string>;
  constructor(public status: number, message: string, details?: Record<string, string>, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.details = details;
    this.code = code;
  }
}

// ── Auto-refresh on 401 ────────────────────────────────────────────────────

// Auth endpoints that must never trigger auto-refresh (prevents infinite loops)
const AUTH_ENDPOINTS = ['/auth/refresh', '/auth/login'];

function isAuthEndpoint(endpoint: string): boolean {
  return AUTH_ENDPOINTS.some(p => endpoint.includes(p));
}

/**
 * Wraps a fetch call with 401 auto-refresh logic.
 * On 401 for non-auth endpoints: attempts token refresh, then retries once.
 */
async function withAutoRefresh(
  endpoint: string,
  doFetch: () => Promise<Response>,
): Promise<Response> {
  let res = await doFetch();

  if (res.status === 401 && !isAuthEndpoint(endpoint)) {
    const refreshed = await refreshIfNeeded();
    if (refreshed) {
      res = await doFetch();
    } else {
      clearSessionCookie();
      window.location.href = '/?session=expired';
      throw new ApiError(401, i18n.t('common:error.sessionExpired'));
    }
  }

  return res;
}

/**
 * Shared error handling for non-OK responses.
 * Prefers the backend's localized `body.message`, falling back to i18n client strings.
 */
async function handleErrorResponse(res: Response): Promise<never> {
  let backendMessage: string | undefined;
  let backendCode: string | undefined;
  let details: Record<string, string> | undefined;
  try {
    const body = await res.json();
    if (body?.message) backendMessage = body.message;
    if (body?.code && typeof body.code === 'string') backendCode = body.code;
    if (body?.details && typeof body.details === 'object') details = body.details;
  } catch { /* ignore parse errors */ }

  if (res.status === 401) {
    throw new ApiError(401, backendMessage ?? i18n.t('common:error.invalidCredentials'), undefined, backendCode);
  }

  if (res.status === 403) {
    throw new ApiError(403, backendMessage ?? i18n.t('common:error.forbidden'), undefined, backendCode);
  }

  throw new ApiError(
    res.status,
    backendMessage ?? i18n.t('common:error.requestFailed', { status: res.status }),
    details,
    backendCode,
  );
}

// ── Core fetch wrapper ──────────────────────────────────────────────────────

export async function api<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await withAutoRefresh(endpoint, () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept-Language': i18n.language,
      ...(options.headers as Record<string, string> ?? {}),
    };

    // Add CSRF header for mutating methods
    const method = (options.method ?? 'GET').toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrf = getCsrfToken();
      if (csrf) headers['X-XSRF-TOKEN'] = csrf;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    return fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));
  });

  if (!res.ok) {
    await handleErrorResponse(res);
  }

  // Some endpoints return 204 No Content
  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

/**
 * Multipart fetch wrapper with the same global error handling as api().
 * Use for FormData uploads (file + JSON) where Content-Type must NOT be set manually.
 */
export async function apiMultipart<T>(
  endpoint: string,
  method: 'POST' | 'PUT',
  body: FormData,
): Promise<T> {
  const res = await withAutoRefresh(endpoint, () => {
    const headers: Record<string, string> = {
      'Accept-Language': i18n.language,
    };

    // Add CSRF header for mutating methods
    const csrf = getCsrfToken();
    if (csrf) headers['X-XSRF-TOKEN'] = csrf;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    return fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers,
      body,
      credentials: 'include',
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));
  });

  if (!res.ok) {
    await handleErrorResponse(res);
  }

  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}
