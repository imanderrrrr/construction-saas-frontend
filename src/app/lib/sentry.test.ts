// Unit coverage for the PII scrubbing helpers exposed by sentry.ts.
// Doesn't boot the Sentry SDK — exercises the pure helpers via the
// __testing__ export.

import { describe, expect, it } from 'vitest';
import { __testing__ } from './sentry';

const { isSensitiveKey, scrubObject, scrubHeaders, SUPPRESSED_API_STATUSES, REDACTED } = __testing__;

describe('isSensitiveKey', () => {
  it('flags credential-like keys', () => {
    for (const key of ['password', 'newPassword', 'currentPassword', 'refreshToken',
      'accessToken', 'apiKey', 'api_key', 'totpCode', 'mfaSecret', 'sessionId',
      'cookie', 'Authorization']) {
      expect(isSensitiveKey(key), `expected ${key} to be sensitive`).toBe(true);
    }
  });

  it('lets harmless keys through', () => {
    for (const key of ['username', 'email', 'fullName', 'projectId', 'amount',
      'createdAt', 'role', 'status']) {
      expect(isSensitiveKey(key), `expected ${key} to be safe`).toBe(false);
    }
  });
});

describe('scrubObject', () => {
  it('redacts sensitive keys, preserves the rest', () => {
    const out = scrubObject({
      username: 'admin',
      password: 'literal-pwd-not-to-leak',
      email: 'alice@example.com',
      refreshToken: 'rt_abc',
      apiKey: 'sk_live_xyz',
      role: 'ADMIN',
    });

    expect(out!.username).toBe('admin');
    expect(out!.email).toBe('alice@example.com');
    expect(out!.role).toBe('ADMIN');
    expect(out!.password).toBe(REDACTED);
    expect(out!.refreshToken).toBe(REDACTED);
    expect(out!.apiKey).toBe(REDACTED);
  });

  it('handles undefined input', () => {
    expect(scrubObject(undefined)).toBeUndefined();
  });
});

describe('scrubHeaders', () => {
  it('drops Authorization and Cookie entirely (does not redact in place)', () => {
    const out = scrubHeaders({
      Authorization: 'Bearer secret-jwt',
      Cookie: 'ofjr_at=abc; ofjr_session=xyz',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0',
    });

    expect(out).not.toHaveProperty('Authorization');
    expect(out).not.toHaveProperty('Cookie');
    expect(out!['Content-Type']).toBe('application/json');
    expect(out!['User-Agent']).toBe('Mozilla/5.0');
  });

  it('drops X-XSRF-TOKEN', () => {
    const out = scrubHeaders({
      'X-XSRF-TOKEN': 'csrf-leak',
      Accept: 'application/json',
    });
    expect(out).not.toHaveProperty('X-XSRF-TOKEN');
    expect(out!.Accept).toBe('application/json');
  });
});

describe('SUPPRESSED_API_STATUSES', () => {
  it('includes the documented client-error statuses', () => {
    for (const code of [400, 401, 403, 404, 409, 410, 422, 429]) {
      expect(SUPPRESSED_API_STATUSES.has(code), `expected ${code} suppressed`).toBe(true);
    }
  });

  it('does NOT suppress 5xx', () => {
    for (const code of [500, 502, 503, 504]) {
      expect(SUPPRESSED_API_STATUSES.has(code), `expected ${code} reported`).toBe(false);
    }
  });
});
