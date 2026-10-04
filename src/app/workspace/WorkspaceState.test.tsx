import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider, useLocation, useNavigate } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceStateProvider, readScreenValue, useProjectFilter, useScreenState, useWorkspace } from './WorkspaceState';
import { workspaceStorageKey } from './paths';

vi.mock('../services/auth', () => ({ AuthService: { getUsername: () => 'alice' } }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Probe() {
  const workspace = useWorkspace()!;
  const location = useLocation();
  const navigate = useNavigate();
  const [q, setQ] = useScreenState('q', '');
  const [project, setProject] = useProjectFilter<number | null>(null, true);
  const [record, setRecord] = useScreenState<number | null>('registro', null, 'push');
  const [tab] = useScreenState('pestana', 'list', 'replace', ['list', 'week']);
  return <>
    <output>{JSON.stringify({ section: workspace.section, q, project, record, tab, path: location.pathname, query: location.search })}</output>
    <button onClick={() => { setQ('escuela'); setProject(13); }}>Filter</button>
    <button onClick={() => setRecord(7)}>Open</button>
    <button onClick={() => navigate(-1)}>Back</button>
    <button onClick={() => workspace.navigateSection('budgets')}>Budgets</button>
    <button onClick={() => workspace.navigateSection('schedules')}>Tasks</button>
    <button onClick={() => workspace.navigateSection('budget-report')}>Alias</button>
    <button onClick={() => workspace.navigateSection('unavailable')}>Unavailable</button>
  </>;
}

describe('recoverable web workspaces', () => {
  let root: Root;
  let host: HTMLDivElement;
  beforeEach(() => {
    sessionStorage.clear();
    document.cookie = 'bt_tenant=acme; Path=/';
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
  async function mount(path: string) {
    const router = createMemoryRouter([{ path: '*', element: <WorkspaceStateProvider role="ADMIN"><Probe /></WorkspaceStateProvider> }], { initialEntries: [path] });
    await act(async () => root.render(<RouterProvider router={router} />));
    return router;
  }
  async function click(label: string) {
    const button = [...host.querySelectorAll('button')].find(b => b.textContent === label)!;
    await act(async () => button.click());
  }
  const state = () => JSON.parse(host.querySelector('output')!.textContent!);

  it('restores direct links and rejects invalid views and worksite IDs', async () => {
    await mount('/admin/tareas?q=escuela&obra=13&registro=7&pestana=invalid');
    expect(state()).toMatchObject({ section: 'schedules', q: 'escuela', project: 13, record: 7, tab: 'list' });
  });
  it('merges filters changed in one click instead of losing the first change', async () => {
    await mount('/admin/tareas'); await click('Filter');
    expect(state()).toMatchObject({ q: 'escuela', project: 13 });
    expect(new URLSearchParams(state().query).get('obra')).toBe('13');
  });
  it('makes the browser back button close a record and retain list filters', async () => {
    await mount('/admin/tareas?q=escuela&obra=13'); await click('Open');
    expect(state().record).toBe(7); await click('Back');
    expect(state()).toMatchObject({ record: null, q: 'escuela', project: 13 });
  });
  it('carries the worksite across modules, restoring each module’s filters', async () => {
    await mount('/admin/tareas?q=escuela&obra=13'); await click('Budgets');
    expect(state()).toMatchObject({ section: 'budgets', project: 13, q: '' });
    await click('Tasks'); expect(state()).toMatchObject({ section: 'schedules', q: 'escuela', project: 13 });
  });
  it('does not reopen a cached record from a different worksite', async () => {
    sessionStorage.setItem(`${workspaceStorageKey('ADMIN', 'alice', 'screens')}.budgets`, '?obra=22&registro=4&historial=5&pagina=3');
    await mount('/admin/tareas?obra=13'); await click('Budgets');
    expect(state()).toMatchObject({ project: 13, record: null });
    expect(new URLSearchParams(state().query).has('historial')).toBe(false);
  });
  it('normalizes previous section names and ignores unknown destinations', async () => {
    await mount('/admin/dashboard'); await click('Alias');
    expect(state().path).toBe('/admin/presupuestos'); await click('Unavailable');
    expect(state().path).toBe('/admin/presupuestos');
  });
  it('scopes browser preferences by tenant, account and role', () => {
    const key = workspaceStorageKey('ADMIN', 'alice', 'screens');
    expect(workspaceStorageKey('FINANCE', 'alice', 'screens')).not.toBe(key);
    expect(workspaceStorageKey('ADMIN', 'bob', 'screens')).not.toBe(key);
    document.cookie = 'bt_tenant=other; Path=/';
    expect(workspaceStorageKey('ADMIN', 'alice', 'screens')).not.toBe(key);
  });
  it('rejects malformed filter objects and unusable pagination values', () => {
    expect(readScreenValue('{bad', { q: '', role: '' })).toEqual({ q: '', role: '' });
    expect(readScreenValue('{"q":22,"role":null}', { q: '', role: '' })).toEqual({ q: '', role: '' });
    expect(readScreenValue('-1', 1)).toBe(1);
    expect(readScreenValue('0', 20)).toBe(20);
    expect(readScreenValue('1.5', 0)).toBe(0);
    expect(readScreenValue('9007199254740992', null)).toBeNull();
  });
});
