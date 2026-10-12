// AUD-055 — the dispatch screen asked for 500 rows, got the newest 100 (the
// server's cap) and computed its KPIs, pages and "of N" from them; its project
// picker read one page of 100 projects. With 230 dispatches and 230 projects,
// the figures must be the server's totals, every page must be reachable, and
// the 230th project must be offered.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({
  getAllDispatches: vi.fn(),
  getDispatchSummary: vi.fn(),
  listConsumables: vi.fn(),
  listWarehouseProjects: vi.fn(),
  dispatchConsumable: vi.fn(),
}));
const users = vi.hoisted(() => ({ listActiveUsers: vi.fn() }));
vi.mock('../services/warehouse', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/warehouse')>()),
  ...svc,
}));
vi.mock('../services/users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/users')>()),
  ...users,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('./budgets/wbs/BudgetLineItemSelector', () => ({ BudgetLineItemSelector: () => null }));
vi.mock('./ui/select', () => {
  const Wrapper = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Select: Wrapper, SelectContent: Wrapper, SelectTrigger: Wrapper,
    SelectValue: () => null,
    SelectItem: ({ children, value }: { children?: React.ReactNode; value: string }) => <div data-option={value}>{children}</div>,
  };
});
vi.mock('./ui/dialog', () => {
  const Wrapper = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Dialog: ({ open, children }: { open?: boolean; children?: React.ReactNode }) => (open ? <div role="dialog">{children}</div> : null),
    DialogContent: Wrapper, DialogHeader: Wrapper, DialogTitle: Wrapper, DialogDescription: Wrapper, DialogFooter: Wrapper,
  };
});

import i18n from '../../i18n';
import { ConsumableDispatch } from './ConsumableDispatch';
import { buttonByText, click, flush, page } from './tools/testing';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const N = 230;
const DISPATCHES = Array.from({ length: N }, (_, i) => ({
  id: N - i, consumableCode: 'CS-900', consumableName: 'Cemento', unit: 'saco',
  quantity: 1 + ((N - i) % 7), totalCostCents: 0, project: `Obra ${1 + ((N - i) % 37)}`,
  requestedBy: 'Pedro', date: '2026-10-01', notes: `despacho-${N - i}`,
}));
const UNITS = DISPATCHES.reduce((s, d) => s + d.quantity, 0);
const PROJECTS = Array.from({ length: N }, (_, i) => ({ id: i + 1, name: `Obra ${String(i + 1).padStart(3, '0')}`, status: 'ACTIVE' as const }));

/** A server that caps every page at 100 rows, as the real one does. */
function slice<T>(rows: T[], params?: { page?: number; size?: number }) {
  const size = Math.min(params?.size ?? 50, 100);
  const pageNo = params?.page ?? 0;
  return page(rows.slice(pageNo * size, pageNo * size + size), rows.length, size, pageNo);
}

describe('ConsumableDispatch — volumes past the server page', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(async () => { await i18n.changeLanguage('es'); });

  beforeEach(() => {
    vi.clearAllMocks();
    svc.getAllDispatches.mockImplementation(async (params?: { page?: number; size?: number }) => slice(DISPATCHES, params));
    svc.getDispatchSummary.mockResolvedValue({ totalDispatches: N, totalUnits: UNITS, projectCount: 37 });
    svc.listConsumables.mockResolvedValue([]);
    svc.listWarehouseProjects.mockImplementation(async (params?: { page?: number; size?: number }) => slice(PROJECTS, params));
    users.listActiveUsers.mockResolvedValue([]);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function mount() {
    await act(async () => { root.render(<ConsumableDispatch />); });
    await flush();
    await flush();
  }

  const figures = () => Array.from(container.querySelectorAll('[data-testid="workspace-figure"]')).map(f => f.textContent ?? '');
  const showing = () => Array.from(container.querySelectorAll('p')).find(p => p.textContent?.startsWith('Mostrando'))?.textContent;

  it('shows the server totals, not figures over the newest hundred', async () => {
    await mount();
    const [dispatches, units, projects] = figures();
    expect(dispatches).toContain(String(N));
    expect(units).toContain(String(UNITS));
    expect(projects).toContain('37');
    expect(showing()).toBe(i18n.t('inventory:dispatch.showing', { from: 1, to: 8, total: N }));
  });

  it('reaches the oldest dispatch on the last page', async () => {
    await mount();
    click(buttonByText(container, String(Math.ceil(N / 8))));
    await flush();
    expect(showing()).toBe(i18n.t('inventory:dispatch.showing', { from: 225, to: N, total: N }));
    expect(container.textContent).toContain('despacho-1');
    expect(svc.getAllDispatches).toHaveBeenLastCalledWith({ page: Math.ceil(N / 8) - 1, size: 8 });
  });

  it('drops a late answer for a page already left', async () => {
    let releasePage2: (() => void) | undefined;
    svc.getAllDispatches.mockImplementation((params?: { page?: number; size?: number }) => {
      if (params?.page === 1) return new Promise(resolve => { releasePage2 = () => resolve(slice(DISPATCHES, params)); });
      return Promise.resolve(slice(DISPATCHES, params));
    });
    await mount();
    click(buttonByText(container, '2'));
    await flush();
    click(buttonByText(container, String(Math.ceil(N / 8))));
    await flush();
    await act(async () => { releasePage2?.(); });
    await flush();
    expect(showing()).toBe(i18n.t('inventory:dispatch.showing', { from: 225, to: N, total: N }));
    expect(container.textContent).toContain('despacho-1');
    expect(container.textContent).not.toContain('despacho-222');
  });

  it('offers the 230th active project in the dispatch dialog', async () => {
    await mount();
    click(buttonByText(container, new RegExp(i18n.t('inventory:dispatch.dispatchSupply'))));
    await flush();
    const options = document.body.querySelectorAll('[role="dialog"] [data-option]');
    expect(document.body.querySelector(`[role="dialog"] [data-option="${N}"]`)?.textContent).toBe('Obra 230');
    expect(options.length).toBe(N);
    expect(svc.listWarehouseProjects).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACTIVE', page: 2 }));
  });
});
