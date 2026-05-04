import { readPlatformSession, clearPlatformSession } from './platformAuthStorage';

// Platform endpoints are bearer-only — no cookies, no CSRF token. The
// existing tenant-side `api()` wrapper assumes cookie auth + CSRF, so
// we keep the platform fetch wrapper separate to avoid an `if (platform)`
// branch on every call.

const BASE_URL = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL ?? '');

export interface PlatformApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
}

interface PlatformApiOptions {
  /** Skip the Authorization header (used by the login endpoints). */
  skipAuth?: boolean;
  body?: unknown;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  signal?: AbortSignal;
}

export async function platformApi<T>(
  endpoint: string,
  options: PlatformApiOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (!options.skipAuth) {
    const session = readPlatformSession();
    if (!session) {
      throw asError(401, 'NO_SESSION', 'Platform session missing.');
    }
    headers['Authorization'] = `Bearer ${session.accessToken}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal ?? controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    throw asError(0, 'NETWORK_ERROR', err instanceof Error ? err.message : 'Network error');
  }
  clearTimeout(timeout);

  // 401 on a normal call → token is dead. Wipe and let the caller
  // surface a redirect to /platform/login. We don't auto-refresh —
  // the platform side keeps the auth flow intentionally explicit.
  if (response.status === 401 && !options.skipAuth) {
    clearPlatformSession();
  }

  if (!response.ok) {
    let parsed: { code?: string; message?: string; details?: unknown } = {};
    try {
      parsed = await response.json();
    } catch {
      // Body wasn't JSON — keep the empty parsed{}.
    }
    throw asError(
      response.status,
      parsed.code,
      parsed.message ?? `Request failed with status ${response.status}`,
      parsed.details,
    );
  }

  // 204 No Content → nothing to parse.
  if (response.status === 204) return undefined as unknown as T;
  return (await response.json()) as T;
}

function asError(status: number, code: string | undefined, message: string, details?: unknown): PlatformApiError {
  const err = new Error(message) as PlatformApiError;
  err.status = status;
  err.code = code;
  err.details = details;
  return err;
}
