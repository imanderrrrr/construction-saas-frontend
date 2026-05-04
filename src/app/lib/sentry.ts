// Sentry initialization for the SPA. Opt-in: if VITE_SENTRY_DSN is unset
// at build time, this module is a no-op and the app behaves identically to
// before. There is no runtime fallback to a hardcoded DSN — by design.
//
// PII rules (mirrors backend SentryConfig.kt):
//   - Strip Authorization / Cookie / X-XSRF-TOKEN request headers
//   - Drop request body and query string from the captured request
//   - Filter Sentry breadcrumbs to remove any field whose key looks
//     credential-like (password, token, secret, mfa, ...)
//   - Suppress documented client errors (401, 403, 404, 422) — those are
//     business outcomes, not bugs
//
// Source maps: NOT uploaded yet. Stack traces will reference minified bundle
// names. Wiring @sentry/vite-plugin requires a SENTRY_AUTH_TOKEN secret in
// CI; we deferred it to keep this PR free of CI-token plumbing. Tracked in
// docs/SENTRY_SETUP.md as a Paso 3+ follow-up.

import * as Sentry from '@sentry/react';

/** Substrings that, if present in any breadcrumb / event key, force redaction. */
const SENSITIVE_KEY_FRAGMENTS = [
  'password',
  'passwd',
  'pwd',
  'token',
  'secret',
  'apikey',
  'api_key',
  'bearer',
  'authorization',
  'session',
  'cookie',
  'mfa',
  'otp',
  'totp',
];

/** HTTP statuses we never report — those are user / business errors. */
const SUPPRESSED_API_STATUSES = new Set([400, 401, 403, 404, 409, 410, 422, 429]);

const REDACTED = '***REDACTED***';

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_FRAGMENTS.some(f => lower.includes(f));
}

function scrubObject(obj: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!obj) return obj;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = isSensitiveKey(k) ? REDACTED : v;
  }
  return out;
}

function scrubHeaders(headers: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!headers) return headers;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (isSensitiveKey(k)) continue; // drop entirely
    out[k] = v;
  }
  return out;
}

/** Returns true if Sentry was initialized (DSN provided), false otherwise. */
export function initSentry(): boolean {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || typeof dsn !== 'string' || dsn.trim() === '') {
    return false;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? 'dev',
    release: import.meta.env.VITE_SENTRY_RELEASE || undefined,

    // No performance tracing for beta — pure error tracking.
    tracesSampleRate: 0,

    // Don't auto-capture user IP / cookies. Custom beforeSend below
    // belt-and-braces strips anything we missed.
    sendDefaultPii: false,

    beforeSend(event, hint) {
      // 1. Drop documented client errors (auth / forbidden / not-found / etc).
      const apiError = hint?.originalException as { status?: number; name?: string } | undefined;
      if (apiError?.name === 'ApiError' && typeof apiError.status === 'number') {
        if (SUPPRESSED_API_STATUSES.has(apiError.status)) return null;
      }

      // 2. Scrub request headers / body / query string.
      if (event.request) {
        event.request.headers = scrubHeaders(event.request.headers as Record<string, string> | undefined);
        event.request.cookies = undefined;
        event.request.data = undefined; // never send body
        event.request.query_string = undefined;
      }

      // 3. Scrub extras / contexts.
      if (event.extra) {
        event.extra = scrubObject(event.extra);
      }

      // 4. Drop user PII; keep stable id only.
      if (event.user) {
        event.user.ip_address = undefined;
        event.user.email = undefined;
        event.user.username = undefined;
      }

      return event;
    },

    beforeBreadcrumb(breadcrumb) {
      // Drop fetch breadcrumbs that hit auth endpoints — their URLs
      // can carry reset / invitation tokens.
      const isAuthFetch =
        breadcrumb.category === 'fetch' &&
        typeof breadcrumb.data?.url === 'string' &&
        /\/(auth|password-reset|invitations|platform\/auth)\b/.test(breadcrumb.data.url as string);
      if (isAuthFetch) return null;

      // Console breadcrumbs may quote sensitive payloads — scrub their data.
      if (breadcrumb.data) {
        breadcrumb.data = scrubObject(breadcrumb.data as Record<string, unknown>) as Record<string, unknown>;
      }
      return breadcrumb;
    },
  });

  return true;
}

// Re-export so call sites don't need to import from @sentry/react directly
// for the common operations (ErrorBoundary + manual capture).
export { Sentry };
export const SentryErrorBoundary = Sentry.ErrorBoundary;

// Test-visible exports — kept here so the unit test can exercise scrub
// logic without booting the full SDK.
export const __testing__ = {
  isSensitiveKey,
  scrubObject,
  scrubHeaders,
  SUPPRESSED_API_STATUSES,
  REDACTED,
  SENSITIVE_KEY_FRAGMENTS,
};
