// AUD-055 — the three labor screens read one page of 100 ACTIVE projects: the
// 101st did not exist for their filter, and a project closed since the period
// reported had vanished from a report about that period. They now read every
// project of every status, all pages, from the endpoint of the screen's role.

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

const projects = vi.hoisted(() => ({ listProjects: vi.fn(), listFinanceProjects: vi.fn() }));
vi.mock('../../services/projects', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/projects')>()),
  ...projects,
}));

import { useLaborProjects, type LaborProject } from './shared';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const N = 230;
const ROWS = [
  { id: 900, name: 'Obra cerrada', status: 'CLOSED', remainingBudgetCents: 0 },
  ...Array.from({ length: N }, (_, i) => ({ id: N - i, name: `Obra ${N - i}`, status: 'ACTIVE', remainingBudgetCents: 1000 })),
];
function servePage(q: { status?: string; page?: number; size?: number } = {}) {
  const rows = q.status ? ROWS.filter(r => r.status === q.status) : ROWS;
  const size = Math.min(q.size ?? 20, 100);
  const page = q.page ?? 0;
  return { content: rows.slice(page * size, page * size + size), page, size, totalElements: rows.length, totalPages: Math.ceil(rows.length / size) };
}

function Probe({ mode, onState }: { mode: 'admin' | 'finance'; onState: (s: { items: LaborProject[]; total: number; truncated: boolean }) => void }) {
  onState(useLaborProjects(mode));
  return null;
}

describe('useLaborProjects', () => {
  it.each([['admin', 'listProjects'], ['finance', 'listFinanceProjects']] as const)(
    'brings every project of every status for %s, from %s',
    async (mode, endpoint) => {
      projects.listProjects.mockReset().mockImplementation(async (q?: object) => servePage(q));
      projects.listFinanceProjects.mockReset().mockImplementation(async (q?: object) => servePage(q));
      let last: { items: LaborProject[]; total: number; truncated: boolean } | null = null;
      const el = document.createElement('div');
      const root = createRoot(el);
      await act(async () => { root.render(<Probe mode={mode} onState={s => { last = s; }} />); });
      for (let i = 0; i < 4; i += 1) await act(async () => { await new Promise(r => setTimeout(r, 0)); });
      const state = last as unknown as { items: LaborProject[]; total: number; truncated: boolean };
      expect(state.items.length).toBe(N + 1);
      expect(state.items.some(p => p.id === 1)).toBe(true);
      expect(state.items.find(p => p.id === 900)?.status).toBe('CLOSED');
      expect(state.total).toBe(N + 1);
      expect(state.truncated).toBe(false);
      expect(projects[endpoint]).toHaveBeenCalledWith(expect.not.objectContaining({ status: expect.anything() }));
      act(() => root.unmount());
    },
  );
});
