import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { clearPlatformSession, readPlatformSession, writePlatformSession } from '../lib/platformAuthStorage';
import type { PlatformRole, PlatformSession } from '../types';

interface PlatformAuthContextValue {
  session: PlatformSession | null;
  isAuthenticated: boolean;
  role: PlatformRole | null;
  setSession: (session: PlatformSession) => void;
  logout: () => void;
}

const PlatformAuthContext = createContext<PlatformAuthContextValue | null>(null);

/**
 * Wrap the platform routes with this provider once. We intentionally
 * mirror the storage state into React so consumers re-render on
 * login/logout — sessionStorage by itself doesn't fire change events
 * for the current tab.
 */
export function PlatformAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<PlatformSession | null>(() => readPlatformSession());

  // Cross-tab sync: another tab logs out → this one updates.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'ofjr_platform_session') {
        setSessionState(readPlatformSession());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setSession = useCallback((next: PlatformSession) => {
    writePlatformSession(next);
    setSessionState(next);
  }, []);

  const logout = useCallback(() => {
    clearPlatformSession();
    setSessionState(null);
  }, []);

  const value = useMemo<PlatformAuthContextValue>(
    () => ({
      session,
      isAuthenticated: session !== null,
      role: session?.role ?? null,
      setSession,
      logout,
    }),
    [session, setSession, logout],
  );

  return <PlatformAuthContext.Provider value={value}>{children}</PlatformAuthContext.Provider>;
}

export function usePlatformAuth(): PlatformAuthContextValue {
  const ctx = useContext(PlatformAuthContext);
  if (!ctx) {
    throw new Error('usePlatformAuth must be used inside <PlatformAuthProvider>');
  }
  return ctx;
}
