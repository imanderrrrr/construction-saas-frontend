import type { PlatformSession } from '../types';

// Why sessionStorage and not localStorage:
//
//   The platform Bearer token grants cross-tenant access and is
//   high-blast-radius. We want it gone the moment the tab closes
//   (sessionStorage is per-tab) so a stolen device can't replay the
//   token from a "remembered" browser. Tenant-side cookies use
//   HttpOnly + Secure for the same reason; the platform side is a
//   pure SPA / Bearer flow so we lean on sessionStorage instead.
//
// Why a single JSON blob instead of multiple keys:
//
//   Atomic read/write — we never want to find a state where the token
//   is present but the role isn't, or vice versa. One key, one parse.

const KEY = 'ofjr_platform_session';

export function readPlatformSession(): PlatformSession | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PlatformSession;
    // Drop expired sessions on read so callers don't have to remember.
    if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    sessionStorage.removeItem(KEY);
    return null;
  }
}

export function writePlatformSession(session: PlatformSession): void {
  sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function clearPlatformSession(): void {
  sessionStorage.removeItem(KEY);
}
