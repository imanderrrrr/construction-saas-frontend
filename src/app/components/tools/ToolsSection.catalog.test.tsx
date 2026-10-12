// AUD-055 — the worker filter of Herramientas read one page of 100 workers:
// with 230, the 130 others (among them whoever left most recently, the person
// the filter exists for) could not be picked. Every worker, active or not,
// must be offered, and picking the 230th must filter by that person.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({
  getAdminTools: vi.fn(), getAdminToolSummary: vi.fn(),
  searchConsumables: vi.fn(), getConsumableSummary: vi.fn(),
  getToolHistory: vi.fn(),
}));
vi.mock('../../services/warehouse', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/warehouse')>()),
  ...svc,
}));
const users = vi.hoisted(() => ({ listUsers: vi.fn() }));
vi.mock('../../services/users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/users')>()),
  listUsers: users.listUsers,
}));

import i18n from '../../../i18n';
import { ToolsSection } from './ToolsSection';
import { CONSUMABLE_SUMMARY, flush, page, select, SUMMARY, tool } from './testing';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const N = 230;
const WORKERS = Array.from({ length: N }, (_, i) => ({
  id: 1000 + i + 1, username: `obrero${i + 1}`, fullName: `Obrero ${i + 1}`, role: 'WORKER',
  status: i === N - 1 ? 'INACTIVE' : 'ACTIVE', updatedAt: '',
}));

function slice<T>(rows: T[], params?: { page?: number; size?: number }) {
  const size = Math.min(params?.size ?? 20, 100);
  const pageNo = params?.page ?? 0;
  return page(rows.slice(pageNo * size, pageNo * size + size), rows.length, size, pageNo);
}

describe('ToolsSection — worker filter past the server page', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(async () => { await i18n.changeLanguage('es'); });

  beforeEach(() => {
    vi.clearAllMocks();
    svc.getAdminTools.mockResolvedValue(page([tool({ id: 1, code: 'HT-002', name: 'Juego de llaves' })]));
    svc.getAdminToolSummary.mockResolvedValue(SUMMARY);
    svc.searchConsumables.mockResolvedValue(page([]));
    svc.getConsumableSummary.mockResolvedValue(CONSUMABLE_SUMMARY);
    svc.getToolHistory.mockResolvedValue([]);
    users.listUsers.mockImplementation(async (params?: { role?: string; page?: number; size?: number }) =>
      slice(params?.role === 'WORKER' ? WORKERS : [], params));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('offers the 230th worker and filters the tools by them', async () => {
    await act(async () => { root.render(<ToolsSection onNavigate={vi.fn()} />); });
    for (let i = 0; i < 4; i += 1) await flush();
    const filter = container.querySelector<HTMLSelectElement>(`select[aria-label="${i18n.t('tools:filter.worker')}"]`)!;
    expect(Array.from(filter.options).map(o => o.value)).toContain(String(1000 + N));
    select(filter, String(1000 + N));
    await flush();
    expect(svc.getAdminTools).toHaveBeenLastCalledWith(expect.objectContaining({ assignedToId: 1000 + N }));
  });
});
