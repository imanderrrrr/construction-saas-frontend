import { createContext, useCallback, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';

export const BrowsingContext = createContext<{
  params: URLSearchParams;
  write: (key: string, value: unknown, history: 'push' | 'replace') => void;
} | null>(null);

/** Public and platform pages retain browsing controls without tenant storage. */
export function BrowsingStateProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const pending = useRef(params);
  useLayoutEffect(() => { pending.current = params; }, [location.key, params]);
  const write = useCallback((key: string, value: unknown, history: 'push' | 'replace') => {
    const next = new URLSearchParams(pending.current);
    const before = next.toString();
    if (value == null || value === '') next.delete(key);
    else next.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    if (next.toString() === before) return;
    pending.current = next;
    navigate({ pathname: location.pathname, search: next.toString() }, { replace: history === 'replace', preventScrollReset: true });
  }, [location.pathname, navigate]);
  const value = useMemo(() => ({ params, write }), [params, write]);
  return <BrowsingContext.Provider value={value}>{children}</BrowsingContext.Provider>;
}
