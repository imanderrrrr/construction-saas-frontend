// OFJR Construction — HTTP API Client
// Single fetch wrapper: baseURL from env, HttpOnly cookie auth, CSRF protection.

import { refreshIfNeeded } from './refresh-coordinator';
import i18n from '../../i18n';
import { getPasswordChangeRequired, setPasswordChangeRequired } from './passwordChangeState';

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
if (typeof localStorage !== 'undefined') {
  LEGACY_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch { /* ignore */ } });
}

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

/**
 * Backend code for "your password is temporary" (TemporaryPasswordFilter).
 * Its own code rather than a bare 403 precisely so this layer can tell it from
 * a real authorization failure and route instead of erroring.
 */
const PASSWORD_CHANGE_REQUIRED_CODE = 'PASSWORD_CHANGE_REQUIRED';

// ── Custom API error ────────────────────────────────────────────────────────

export class ApiError extends Error {
  /** Domain error code from the backend (e.g. "BUDGET_EXCEEDED", "NOT_ASSIGNED"). */
  public code?: string;
  /** Field-level validation details from backend (e.g. { username: "must be 3-50 characters" }) */
  public details?: Record<string, string>;
  /**
   * Seconds to wait before retrying, from the `Retry-After` header of a 429.
   * Undefined when the server sent none; screens fall back to their own default.
   */
  public retryAfterSeconds?: number;
  constructor(public status: number, message: string, details?: Record<string, string>, code?: string, retryAfterSeconds?: number) {
    super(message);
    this.name = 'ApiError';
    this.details = details;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * `Retry-After` comes as delta-seconds or as an HTTP date; either way the
 * caller wants "how long from now", never negative.
 */
export function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds));
  const at = Date.parse(header);
  if (Number.isNaN(at)) return undefined;
  return Math.max(0, Math.round((at - Date.now()) / 1000));
}

// ── Auto-refresh on 401 ────────────────────────────────────────────────────

// Auth endpoints that must never trigger auto-refresh (prevents infinite loops).
// A 401 here is still a credentials / token failure for an authenticated flow,
// so we let it surface as an ApiError but skip the refresh attempt.
const AUTH_ENDPOINTS = [
  '/auth/refresh',
  '/auth/login',
  // Changing your own password answers 401 for exactly one reason: the current
  // password was wrong. Retrying after a refresh cannot help — the password is
  // still wrong — and it costs a second attempt against
  // PasswordSetupRateLimiter, so a user who mistypes once is charged twice and
  // gets locked out in half the tries. Observed live: one click produced two
  // 401s with a token refresh wedged between them.
  '/auth/change-password',
];

// Public / anonymous endpoints used by pre-auth flows (signup, password reset,
// invitation preview/accept). A 401 here MUST NOT trigger auto-refresh or the
// global `/?session=expired` redirect: the user is not signed in, so the only
// session that could "expire" is a stale residual cookie from a prior login.
// Treating that as a global expiration breaks the signup → Paddle handoff by
// reloading the landing page mid-flow. Instead, propagate the 401 as an
// ApiError so the page can render an inline error and let the user retry.
const ANONYMOUS_ENDPOINTS = [
  '/signup/checkout',
  '/signup/complete',
  '/auth/signup',
  // request, confirm and the GET preview of a link — all before any session.
  '/auth/password-reset/',
  '/auth/invitations/',
  // Client portal (public read-only site-log view): auth is the portal token,
  // not a user session. A 401/410 here must render inline on the public page,
  // never bounce the visitor to /?session=expired.
  '/client-view/',
  // Public signing surface: same reasoning as the client portal. A 401/410
  // must render inline on the public page, never bounce the signer to
  // /?session=expired — they have no session to expire.
  '/sign/',
];

function isAuthEndpoint(endpoint: string): boolean {
  return AUTH_ENDPOINTS.some(p => endpoint.includes(p));
}

function isAnonymousEndpoint(endpoint: string): boolean {
  return ANONYMOUS_ENDPOINTS.some(p => endpoint.includes(p));
}

/**
 * Wraps a fetch call with 401 auto-refresh logic.
 *
 * - Auth endpoints (`/auth/login`, `/auth/refresh`): no refresh, no redirect —
 *   the 401 surfaces as an ApiError (bad credentials / refresh failed).
 * - Anonymous endpoints (signup, password reset, invitation accept): no refresh,
 *   no redirect — the 401 surfaces as an ApiError so the page renders it inline.
 * - Everything else (protected endpoints): attempt token refresh once; on
 *   success retry, on failure clear the session cookie and redirect to the
 *   landing page with `?session=expired`.
 */
async function withAutoRefresh(
  endpoint: string,
  doFetch: () => Promise<Response>,
): Promise<Response> {
  const res = await doFetch();

  if (res.status !== 401) return res;
  if (isAuthEndpoint(endpoint) || isAnonymousEndpoint(endpoint)) return res;

  const refreshed = await refreshIfNeeded();
  if (refreshed) {
    return doFetch();
  }
  clearSessionCookie();
  window.location.href = '/?session=expired';
  throw new ApiError(401, i18n.t('common:error.sessionExpired'));
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
    // The password gate, not an authorization failure. Anything a user still
    // on an admin-issued password touches comes back this way, so recognising
    // it centrally is what keeps a blocked call from surfacing as a stray
    // error toast on whatever screen happened to fire it.
    //
    // Recording the verdict is usually enough — PasswordChangeGuard wraps
    // every internal route, so the next render already shows the form. The
    // reload is the backstop for a call fired from an already-mounted tree,
    // which would otherwise sit there looking broken. It runs only on the
    // FIRST such 403: afterwards the guard is showing the form and no product
    // call is in flight to trigger another, so there is no reload loop.
    if (backendCode === PASSWORD_CHANGE_REQUIRED_CODE) {
      const firstTime = getPasswordChangeRequired() !== true;
      setPasswordChangeRequired(true);
      if (firstTime && typeof window !== 'undefined') window.location.reload();
    }
    throw new ApiError(403, backendMessage ?? i18n.t('common:error.forbidden'), undefined, backendCode);
  }

  throw new ApiError(
    res.status,
    backendMessage ?? i18n.t('common:error.requestFailed', { status: res.status }),
    details,
    backendCode,
    res.status === 429 ? parseRetryAfter(res.headers.get('Retry-After')) : undefined,
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
