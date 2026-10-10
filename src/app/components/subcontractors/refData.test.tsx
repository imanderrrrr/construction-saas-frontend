// AUD-055 — the Subcontratistas section asked for 200 subcontractors and 200
// projects, which the server cut to 100 each without a word: the 101st was
// neither in the filters nor in the assign window. Both lists are whole now.

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

const users = vi.hoisted(() => ({ listUsers: vi.fn() }));
const http = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('../../services/users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/users')>()),
  ...users,
}));
vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  api: (...args: unknown[]) => http.api(...args),
}));

import { useRefData, type RefData } from './refData';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const N = 230;
function servePage<T>(rows: T[], q: { page?: number; size?: number } = {}) {
  const size = Math.min(q.size ?? 20, 100);
  const page = q.page ?? 0;
  return { content: rows.slice(page * size, page * size + size), page, size, totalElements: rows.length, totalPages: Math.ceil(rows.length / size) };
}
const SUBS = Array.from({ length: N }, (_, i) => ({ id: i + 1, username: `sub${i + 1}`, fullName: `Sub ${i + 1}`, role: 'SUBCONTRACTOR', status: i === N - 1 ? 'INACTIVE' : 'ACTIVE', updatedAt: '' }));
const PROJECTS = Array.from({ length: N }, (_, i) => ({ id: i + 1, name: `Obra ${i + 1}`, status: i === 0 ? 'CLOSED' : 'ACTIVE' }));

function Probe({ onState }: { onState: (s: RefData) => void }) {
  onState(useRefData());
  return null;
}

describe('useRefData', () => {
  it('brings every subcontractor and every project, deactivated and closed ones included', async () => {
    users.listUsers.mockImplementation(async (q?: { role?: string; page?: number; size?: number }) => servePage(q?.role === 'SUBCONTRACTOR' ? SUBS : [], q));
    http.api.mockImplementation(async (path: string) => {
      if (!path.startsWith('/api/v1/admin/projects')) throw new Error(`Unexpected request: ${path}`);
      const q = new URLSearchParams(path.split('?')[1] ?? '');
      return servePage(PROJECTS, { page: Number(q.get('page') ?? 0), size: Number(q.get('size') ?? 20) });
    });
    let last: RefData | null = null;
    const el = document.createElement('div');
    const root = createRoot(el);
    await act(async () => { root.render(<Probe onState={s => { last = s; }} />); });
    for (let i = 0; i < 5; i += 1) await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    const state = last as unknown as RefData;
    expect(state.state).toBe('ready');
    expect(state.subcontractors.length).toBe(N);
    expect(state.subcontractors.some(s => s.id === N)).toBe(true);
    expect(state.projects.length).toBe(N);
    expect(state.projects.some(p => p.id === 1)).toBe(true);
    expect(state.catalogs).toEqual({ subcontractors: { total: N, truncated: false }, projects: { total: N, truncated: false } });
    act(() => root.unmount());
  });
});
