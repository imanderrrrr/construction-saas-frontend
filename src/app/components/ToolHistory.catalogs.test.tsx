// AUD-055 — the history filters were the first 100 tools, and "Person" was
// whoever held one of those tools today: the history of a worker who returned
// everything (someone who left) could not be filtered, and the value sent was
// the display name while the server matches the username. With 230 tools and
// 230 workers, the 230th of each must be offered, and the filter must carry
// the username.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({ listTools: vi.fn(), getGlobalToolHistory: vi.fn() }));
const users = vi.hoisted(() => ({ listUsers: vi.fn() }));
vi.mock('../services/warehouse', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/warehouse')>()),
  ...svc,
}));
vi.mock('../services/users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/users')>()),
  ...users,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('./ui/select', async () => {
  const { createContext, useContext } = await import('react');
  const Ctx = createContext<{ value?: string; onValueChange?: (v: string) => void }>({});
  return {
    Select: ({ value, onValueChange, children }: { value?: string; onValueChange?: (v: string) => void; children?: React.ReactNode }) =>
      <Ctx.Provider value={{ value, onValueChange }}>{children}</Ctx.Provider>,
    SelectTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    SelectValue: () => null,
    SelectContent: ({ children }: { children?: React.ReactNode }) => {
      const c = useContext(Ctx);
      return <select value={c.value ?? ''} onChange={e => c.onValueChange?.(e.target.value)}>{children}</select>;
    },
    SelectItem: ({ value }: { value: string }) => <option value={value}>{value}</option>,
  };
});

import i18n from '../../i18n';
import { ToolHistory } from './ToolHistory';
import { buttonByText, click, flush, page, select, tool } from './tools/testing';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const N = 230;
// The 230 tools are all back in the warehouse: nobody holds one today.
const TOOLS = Array.from({ length: N }, (_, i) => {
  const n = String(i + 1).padStart(4, '0');
  return tool({ id: i + 1, code: `T-${n}`, name: `Taladro ${n}`, assignedTo: i < 5 ? `Persona ${i + 1}` : null });
});
const WORKERS = Array.from({ length: N }, (_, i) => ({
  id: i + 1, username: `persona${i + 1}`, fullName: `Persona ${i + 1}`, role: 'WORKER',
  status: i === N - 1 ? 'INACTIVE' : 'ACTIVE', updatedAt: '',
}));

function slice<T>(rows: T[], params?: { page?: number; size?: number }) {
  const size = Math.min(params?.size ?? 20, 100);
  const pageNo = params?.page ?? 0;
  return page(rows.slice(pageNo * size, pageNo * size + size), rows.length, size, pageNo);
}

describe('ToolHistory — filter catalogs past the server page', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(async () => { await i18n.changeLanguage('es'); });

  beforeEach(() => {
    vi.clearAllMocks();
    svc.listTools.mockImplementation(async (params?: { page?: number; size?: number }) => slice(TOOLS, params));
    svc.getGlobalToolHistory.mockResolvedValue(page([]));
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

  async function mount() {
    await act(async () => { root.render(<ToolHistory />); });
    for (let i = 0; i < 4; i += 1) await flush();
  }

  // Tool, action, worker — in the order the bar draws them.
  const selects = () => Array.from(container.querySelectorAll('select'));
  const values = (el: HTMLSelectElement) => Array.from(el.options).map(o => o.value);

  it('offers the 230th tool and the 230th worker, who holds nothing today and is no longer active', async () => {
    await mount();
    const [tools, , workers] = selects();
    expect(values(tools)).toContain('T-0230');
    expect(values(workers)).toContain('persona230');
  });

  it('gives every person option the username the server matches, not the display name', async () => {
    await mount();
    const [, , workers] = selects();
    const usernames = new Set(WORKERS.map(w => w.username));
    const offered = values(workers).filter(v => v !== 'all');
    expect(offered.length).toBe(N);
    expect(offered.every(v => usernames.has(v))).toBe(true);
  });

  it('filters by the username the server matches', async () => {
    await mount();
    const [, , workers] = selects();
    select(workers, 'persona230');
    click(buttonByText(container, i18n.t('common:buttons.apply')));
    await flush();
    expect(svc.getGlobalToolHistory).toHaveBeenLastCalledWith(expect.objectContaining({ worker: 'persona230', page: 0 }));
  });
});
