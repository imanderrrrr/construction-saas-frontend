import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { AuthService } from '../services/auth';
import { WORKSPACE_PATHS, resolveSection, sectionForPath, workspaceStorageKey, type WorkspaceRole } from './paths';
import { BrowsingContext } from './BrowsingState';
import { UnsavedChangesProvider } from './UnsavedChanges';

type HistoryMode = 'push' | 'replace';
interface WorkspaceState {
  role: WorkspaceRole;
  section: string;
  params: URLSearchParams;
  write: (key: string, value: unknown, history: HistoryMode) => void;
  navigateSection: (section: string, values?: Record<string, string | number | null>, history?: HistoryMode) => void;
}
const Context = createContext<WorkspaceState | null>(null);

function storedParams(key: string, section: string): string {
  try { return sessionStorage.getItem(`${key}.${section}`) ?? ''; } catch { return ''; }
}

/** Only browsing state goes into the URL: never credentials or form/payment data. */
export function WorkspaceStateProvider({ role, children }: { role: WorkspaceRole; children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const section = resolveSection(role, sectionForPath(role, location.pathname)
    ?? (role === 'FINANCE' && location.pathname === '/finance/invoices' ? 'accounts-receivable' : 'dashboard'));
  const storage = workspaceStorageKey(role, AuthService.getUsername() ?? 'anon', 'screens');
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  // Setters in the same click can update several filters. Each sees the latest
  // requested query, even before the router has painted the preceding change.
  const pending = useRef({ key: location.key, params: new URLSearchParams(location.search) });
  useLayoutEffect(() => {
    pending.current = { key: location.key, params: new URLSearchParams(location.search) };
  }, [location.key, location.search]);

  useEffect(() => {
    try { sessionStorage.setItem(`${storage}.${section}`, location.search); } catch { /* optional persistence */ }
  }, [storage, section, location.search]);

  const write = useCallback((key: string, value: unknown, history: HistoryMode) => {
    const next = new URLSearchParams(pending.current.params);
    const before = next.toString();
    if (value === null || value === undefined || value === '') next.delete(key);
    else next.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    if (before === next.toString()) return;
    if (key === 'obra' || key === 'filtros') {
      [...next.keys()].filter(k => k === 'pagina' || k.startsWith('pagina-')).forEach(k => next.delete(k));
    }
    pending.current.params = next;
    const search = next.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: history === 'replace', preventScrollReset: true });
  }, [location.pathname, navigate]);

  const navigateSection = useCallback((requested: string, values?: Record<string, string | number | null>, history: HistoryMode = 'push') => {
    const target = resolveSection(role, requested);
    const path = WORKSPACE_PATHS[role][target];
    if (!path) return;
    if (target === section && !values) return;
    const next = new URLSearchParams(target === section ? pending.current.params : storedParams(storage, target));
    // A single explicitly selected worksite accompanies every cross-module jump.
    const project = pending.current.params.get('obra');
    if (next.get('obra') !== project) {
      ['registro', 'historial', 'pagina'].forEach(key => next.delete(key));
    }
    if (project) next.set('obra', project); else next.delete('obra');
    Object.entries(values ?? {}).forEach(([key, value]) => {
      if (value == null || value === '') next.delete(key); else next.set(key, String(value));
    });
    const search = next.toString();
    navigate({ pathname: path, search: search ? `?${search}` : '' }, { replace: history === 'replace' });
  }, [navigate, role, section, storage]);

  const value = useMemo(() => ({ role, section, params, write, navigateSection }), [role, section, params, write, navigateSection]);
  return <UnsavedChangesProvider><Context.Provider value={value}>{children}</Context.Provider></UnsavedChangesProvider>;
}

export function useWorkspace() { return useContext(Context); }

export function useSectionNavigation<T extends string>(role: WorkspaceRole, initial: T) {
  const context = useWorkspace();
  const navigate = useNavigate();
  const [local, setLocal] = useState<T>(initial);
  const setSection = useCallback((requested: string, values?: Record<string, string | number | null>, history: HistoryMode = 'push') => {
    const target = resolveSection(role, requested);
    if (!WORKSPACE_PATHS[role][target]) return;
    if (context) context.navigateSection(target, values, history);
    else {
      setLocal(target as T);
      if (!values) navigate(WORKSPACE_PATHS[role][target]);
      else {
        const query = new URLSearchParams();
        Object.entries(values).forEach(([key, value]) => { if (value != null && value !== '') query.set(key, String(value)); });
        navigate({ pathname: WORKSPACE_PATHS[role][target], search: query.size ? `?${query}` : '' }, { replace: history === 'replace' });
      }
    }
  }, [context, navigate, role]);
  return [(context?.section ?? local) as T, setSection] as const;
}

function compatible(value: unknown, initial: unknown, key?: string): boolean {
  // Budget filters explicitly accept a numeric client or the 'all' sentinel.
  if (key === 'clientId') return value === 'all' || typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
  if (initial === null) return value === null || typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
  if (typeof initial === 'number') return typeof value === 'number' && Number.isSafeInteger(value) && value >= (initial > 0 ? 1 : 0);
  if (typeof initial === 'string') return typeof value === 'string';
  if (typeof initial === 'boolean') return typeof value === 'boolean';
  if (Array.isArray(initial)) return Array.isArray(value);
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.entries(initial as Record<string, unknown>).every(([key, item]) => compatible((value as Record<string, unknown>)[key], item, key));
}

export function readScreenValue<T>(raw: string | null, initial: T): T {
  if (raw == null || raw.length > 6000) return initial;
  if (typeof initial === 'string') return raw as T;
  try { const value: unknown = JSON.parse(raw); return compatible(value, initial) ? value as T : initial; } catch { return initial; }
}

/** Works in isolated component tests too; the router-backed provider is optional. */
export function useScreenState<T>(key: string, initial: T | (() => T), history: HistoryMode = 'replace', allowed?: readonly T[]): [T, Dispatch<SetStateAction<T>>] {
  const workspace = useWorkspace();
  const browsing = useContext(BrowsingContext);
  const context = workspace ?? browsing;
  const params = context?.params;
  const [fallback, setFallback] = useState(initial);
  const parsed = useMemo(() => params ? readScreenValue(params.get(key), fallback) : fallback, [params, key, fallback]);
  const typed = typeof fallback === 'string' && ['cliente', 'responsable', 'subcontratista'].includes(key) && /^\d+$/.test(String(parsed)) && Number.isSafeInteger(Number(parsed)) && Number(parsed) > 0 ? Number(parsed) as T : parsed;
  const value = allowed && !allowed.includes(typed) ? fallback : typed;
  const set = useCallback((action: SetStateAction<T>) => {
    if (!context) { setFallback(action); return; }
    const next = typeof action === 'function' ? (action as (prev: T) => T)(value) : action;
    context.write(key, next, history);
  }, [context, history, key, value]);
  return [value, set];
}

/** Worksite filters share one value; the empty value preserves each control's contract. */
export function useProjectFilter<T extends string | number | null>(empty: T, numeric = false): [T, Dispatch<SetStateAction<T>>] {
  const context = useWorkspace();
  const [fallback, setFallback] = useState(empty);
  const raw = context?.params.get('obra');
  const id = raw && /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)) && Number(raw) > 0 ? raw : null;
  const value = context ? (id ? (numeric || typeof empty === 'number' ? Number(id) : id) as T : empty) : fallback;
  const set = useCallback((action: SetStateAction<T>) => {
    if (!context) { setFallback(action); return; }
    const next = typeof action === 'function' ? (action as (prev: T) => T)(value) : action;
    context.write('obra', next === empty ? null : next, 'replace');
  }, [context, empty, value]);
  return [value, set];
}

/** Object-shaped filters keep their worksite in the shared selector. */
export function useWorksiteFilters<T extends { projectId: string }>(initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const workspace = useWorkspace();
  const hasWorkspace = workspace !== null;
  const [defaults] = useState(initial);
  const [filters, setFilters] = useScreenState('filtros', defaults);
  const [projectId, setProjectId] = useProjectFilter<string>('all');
  const value = useMemo(() => ({ ...filters, projectId: hasWorkspace ? projectId : filters.projectId }), [filters, projectId, hasWorkspace]);
  const set = useCallback((action: SetStateAction<T>) => {
    const next = typeof action === 'function' ? (action as (previous: T) => T)(value) : action;
    if (workspace && next.projectId !== projectId) setProjectId(next.projectId);
    setFilters({ ...next, projectId: workspace ? 'all' : next.projectId });
  }, [projectId, setFilters, setProjectId, value, workspace]);
  return [value, set];
}
