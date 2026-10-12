// AUD-055 — an ADMIN capturing T&M picked the project from one page of 100,
// closed ones included: with 230 active projects the 130 oldest could not be
// chosen. The picker must offer every ACTIVE project — the server takes field
// work only on an active one — walking all the pages.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({ listFieldTmTickets: vi.fn(), getFieldTmPending: vi.fn() }));
const projects = vi.hoisted(() => ({ listProjects: vi.fn(), listFinanceProjects: vi.fn() }));
vi.mock('../../services/tm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/tm')>()),
  ...svc,
}));
vi.mock('../../services/projects', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/projects')>()),
  ...projects,
}));
vi.mock('../../services/time', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/time')>()),
  getSupervisorProjects: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../services/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/auth')>();
  return { ...actual, AuthService: { ...actual.AuthService, getRole: () => 'ADMIN', getCanonicalRole: () => 'ADMIN' } };
});

import i18n from '../../../i18n';
import { TmFieldSection } from './TmFieldSection';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const N = 230;
const ACTIVE = Array.from({ length: N }, (_, i) => ({ id: i + 1, name: `Obra ${String(i + 1).padStart(3, '0')}`, status: 'ACTIVE' }));
const CLOSED = [{ id: 999, name: 'Obra cerrada', status: 'CLOSED' }];

/** The server: optional status filter, newest first, at most 100 per page. */
function serve(q: { status?: string; page?: number; size?: number } = {}) {
  const rows = q.status ? [...CLOSED, ...ACTIVE].filter(p => p.status === q.status) : [...CLOSED, ...ACTIVE];
  const size = Math.min(q.size ?? 20, 100);
  const pageNo = q.page ?? 0;
  return { content: rows.slice(pageNo * size, pageNo * size + size), page: pageNo, size, totalElements: rows.length, totalPages: Math.ceil(rows.length / size) };
}

describe('TmFieldSection — the ADMIN project picker past the server page', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await i18n.changeLanguage('es');
    vi.clearAllMocks();
    svc.listFieldTmTickets.mockResolvedValue([]);
    svc.getFieldTmPending.mockResolvedValue({ ticketCount: 0, totalPending: 0, oldestAgeDays: 0, tickets: [] });
    projects.listProjects.mockImplementation(async (q?: { status?: string; page?: number; size?: number }) => serve(q));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
  });

  it('offers every active project and no closed one', async () => {
    await act(async () => { root.render(<TmFieldSection />); });
    for (let i = 0; i < 5; i += 1) await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    const filter = container.querySelector<HTMLSelectElement>(`select[aria-label="${i18n.t('tm:filter.project')}"]`)!;
    const values = Array.from(filter.options).map(o => o.value).filter(Boolean);
    expect(values).toContain(String(N));
    expect(values).not.toContain('999');
    expect(values.length).toBe(N);
  });
});
