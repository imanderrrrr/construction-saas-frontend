// AUD-055 — the assignment dialog offered the first 100 available tools the
// server returned and nothing else: with 230 available tools, the other 130
// could not be assigned from the web. The dialog now searches the server,
// loads further pages on demand, says how many there are in all, keeps the
// picked tool whatever the search shows next, and ignores late answers.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({
  getActiveAssignments: vi.fn(),
  getAssignmentLog: vi.fn(),
  getAssignmentSummary: vi.fn(),
  assignTool: vi.fn(),
  listTools: vi.fn(),
  getWorkerProjects: vi.fn(),
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

// Radix Select does not open in jsdom: a native <select> stands in for it.
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
      return <select value={c.value ?? ''} onChange={e => c.onValueChange?.(e.target.value)}><option value="" />{children}</select>;
    },
    SelectItem: ({ value }: { value: string }) => <option value={value}>{value}</option>,
  };
});
vi.mock('./ui/dialog', () => ({
  Dialog: ({ open, children }: { open?: boolean; children?: React.ReactNode }) => (open ? <div role="dialog">{children}</div> : null),
  DialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

import i18n from '../../i18n';
import { ToolAssignment } from './ToolAssignment';
import { buttonByText, click, flush, page, select, tool, type } from './tools/testing';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const AVAILABLE = Array.from({ length: 230 }, (_, i) => {
  const n = String(i + 1).padStart(4, '0');
  return tool({ id: i + 1, code: `T-${n}`, name: `Taladro ${n}` });
});

/** The server: matches code or name, caps the page at 100, answers pages in order. */
function serve(params?: { search?: string; page?: number; size?: number }) {
  const q = params?.search?.toLowerCase() ?? '';
  const rows = AVAILABLE.filter(t => !q || t.code.toLowerCase().includes(q) || t.name.toLowerCase().includes(q));
  const size = Math.min(params?.size ?? 20, 100);
  const pageNo = params?.page ?? 0;
  return page(rows.slice(pageNo * size, pageNo * size + size), rows.length, size, pageNo);
}

describe('ToolAssignment — available tools beyond the first page', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(async () => { await i18n.changeLanguage('es'); });

  beforeEach(() => {
    vi.clearAllMocks();
    svc.getActiveAssignments.mockResolvedValue([]);
    svc.getAssignmentLog.mockResolvedValue(page([]));
    svc.getAssignmentSummary.mockResolvedValue({ activeAssignments: 0, assignedToday: 0, returnedToday: 0 });
    svc.listTools.mockImplementation(async (params?: { search?: string; page?: number; size?: number }) => serve(params));
    svc.getWorkerProjects.mockResolvedValue([{ id: 5, name: 'Obra Norte' }]);
    svc.assignTool.mockResolvedValue({ id: 1 });
    users.listActiveUsers.mockResolvedValue([{ id: 9, username: 'pedro', fullName: 'Pedro', role: 'WORKER', status: 'ACTIVE' }]);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const dialog = () => document.body.querySelector('[role="dialog"]')!;
  const search = () => dialog().querySelector<HTMLInputElement>('input[type="search"]');
  const option = (code: string) => Array.from(dialog().querySelectorAll('[role="option"]')).find(o => o.textContent?.startsWith(code));
  const shown = () => dialog().querySelector('[role="status"]')?.textContent;

  async function openDialog() {
    await act(async () => { root.render(<ToolAssignment />); });
    await flush();
    click(buttonByText(container, i18n.t('inventory:assignment.assignTool')));
    await flush();
  }

  async function searchFor(text: string) {
    type(search()!, text);
    await flush(300); // past the debounce
  }

  async function chooseWorkerAndProject() {
    const [worker] = Array.from(dialog().querySelectorAll('select'));
    select(worker, '9');
    await flush();
    const [, project] = Array.from(dialog().querySelectorAll('select'));
    select(project, '5');
    await flush();
  }

  it('finds and assigns an available tool past the first hundred', async () => {
    await openDialog();
    expect(search()).not.toBeNull();
    await searchFor('T-0230');
    expect(svc.listTools).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'Available', search: 'T-0230' }));
    click(option('T-0230'));
    await chooseWorkerAndProject();
    click(buttonByText(dialog(), i18n.t('inventory:assignment.assignTool')));
    await flush();

    expect(svc.assignTool).toHaveBeenCalledTimes(1);
    expect(svc.assignTool).toHaveBeenCalledWith(expect.objectContaining({ toolCode: 'T-0230', toolName: 'Taladro 0230', workerId: 9, projectId: 5 }));
  });

  it('says how many there are in all and loads more on demand', async () => {
    await openDialog();
    expect(shown()).toBe(i18n.t('inventory:assignment.dialog.toolsShown', { shown: 25, total: 230 }));
    click(buttonByText(dialog(), i18n.t('inventory:assignment.dialog.moreTools')));
    await flush();
    expect(shown()).toBe(i18n.t('inventory:assignment.dialog.toolsShown', { shown: 50, total: 230 }));
    expect(option('T-0050')).toBeDefined();
    expect(svc.listTools).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
  });

  it('keeps the picked tool while the search shows other ones', async () => {
    await openDialog();
    click(option('T-0007'));
    await searchFor('sin coincidencias');
    expect(dialog().textContent).toContain(i18n.t('inventory:assignment.dialog.noToolMatch'));
    expect(dialog().textContent).toContain(i18n.t('inventory:assignment.dialog.selectedTool', { code: 'T-0007', name: 'Taladro 0007' }));
    await chooseWorkerAndProject();
    click(buttonByText(dialog(), i18n.t('inventory:assignment.assignTool')));
    await flush();
    expect(svc.assignTool).toHaveBeenCalledWith(expect.objectContaining({ toolCode: 'T-0007' }));
  });

  it('ignores a late answer to an older search', async () => {
    let releaseOld: (() => void) | undefined;
    svc.listTools.mockImplementation((params?: { search?: string; page?: number; size?: number }) => {
      if (params?.search === 'T-01') return new Promise(resolve => { releaseOld = () => resolve(serve(params)); });
      return Promise.resolve(serve(params));
    });
    await openDialog();
    await searchFor('T-01');
    await searchFor('T-0229');
    expect(option('T-0229')).toBeDefined();
    await act(async () => { releaseOld?.(); });
    await flush();
    expect(option('T-0229')).toBeDefined();
    expect(option('T-0100')).toBeUndefined();
    expect(shown()).toBe(i18n.t('inventory:assignment.dialog.toolsShown', { shown: 1, total: 1 }));
  });
});
