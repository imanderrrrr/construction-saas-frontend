// Herramientas: the screen (sheets 01–06).
//
// The three things that must hold no matter what: the figure strip is the
// server's and stays the company's even with a filter on (that is the error
// these redesigns came to remove), a failure says so and offers a retry
// instead of an empty table, and a save updates the row in place — the sheets
// ask for the flash, not a toast.

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
import { ApiError } from '../../lib/api';
import { ToolsSection } from './ToolsSection';
import {
  buttonByText, click, CONSUMABLE_SUMMARY, consumable, flush, page, select, SUMMARY, tool, type,
} from './testing';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const TOOLS = [
  tool({ id: 1, code: 'PT-014', name: 'Rotomartillo Bosch GBH 2-26', status: 'Pending Acceptance', assignedTo: 'Édgar Xocop', assignedToId: 31, projectName: 'Torre Zona 14' }),
  tool({ id: 2, code: 'PT-021', name: 'Sierra circular Makita 5007', status: 'Assigned', assignedTo: 'Byron Chávez', assignedToId: 44, projectName: 'Torre Zona 14' }),
  tool({ id: 3, code: 'HT-002', name: 'Juego de llaves Stanley', category: 'Hand Tools', status: 'Available' }),
];

const WORKERS = [
  { id: 31, username: 'exocop', fullName: 'Édgar Xocop', role: 'WORKER' },
  { id: 44, username: 'bchavez', fullName: 'Byron Chávez', role: 'WORKER' },
];
const KEEPERS = [{ id: 9, username: 'sixcot', fullName: 'Sandra Ixcot', role: 'WAREHOUSE' }];

function figures(container: HTMLElement) {
  return Array.from(container.querySelector('[data-testid="tools-figures"]')!.children) as HTMLElement[];
}

describe('ToolsSection', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(async () => { await i18n.changeLanguage('es'); });

  beforeEach(async () => {
    vi.clearAllMocks();
    svc.getAdminTools.mockResolvedValue(page(TOOLS, 214));
    svc.getAdminToolSummary.mockResolvedValue(SUMMARY);
    svc.searchConsumables.mockResolvedValue(page([consumable({ id: 5, code: 'CS-003', name: 'Tornillo 2"', currentStock: 8, minimumStock: 10, status: 'Low Stock' })], 62));
    svc.getConsumableSummary.mockResolvedValue(CONSUMABLE_SUMMARY);
    svc.getToolHistory.mockResolvedValue([]);
    users.listUsers.mockImplementation(({ role }: { role: string }) =>
      Promise.resolve(page(role === 'WAREHOUSE' ? KEEPERS : WORKERS)));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function mount(onNavigate = vi.fn()) {
    await act(async () => { root.render(<ToolsSection onNavigate={onNavigate} />); });
    await flush();
    return onNavigate;
  }

  it('takes the seven figures from the summary, not from the page it loaded', async () => {
    await mount();
    const values = figures(container).map(f => f.querySelector('.tabular-nums')!.textContent);
    expect(values).toEqual(['214', '96', '74', '14', '18', '8', '4']);
    // Three rows on screen, and the strip still says 214.
    expect(container.querySelectorAll('[data-testid^="tool-row-"]').length).toBe(3);
  });

  it('adds up: the total is the sum of the six states, pending acceptance included', () => {
    const { total, available, assigned, pendingAcceptance, inReview, damaged, lost } = SUMMARY;
    expect(available + assigned + pendingAcceptance + inReview + damaged + lost).toBe(total);
  });

  it('keeps the strip on the company when a filter narrows the table', async () => {
    await mount();
    svc.getAdminTools.mockResolvedValueOnce(page([TOOLS[0]], 1));
    click(figures(container)[3]);            // Pendientes de aceptación
    await flush();

    expect(svc.getAdminTools).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'Pending Acceptance', page: 0 }));
    expect(figures(container)[0].querySelector('.tabular-nums')!.textContent).toBe('214');
    expect(figures(container)[3].getAttribute('aria-pressed')).toBe('true');
  });

  it('degrades every figure to a dash when the summary fails, and still draws the table', async () => {
    svc.getAdminToolSummary.mockRejectedValue(new Error('nope'));
    await mount();

    expect(figures(container).every(f => f.textContent?.includes('—'))).toBe(true);
    expect(container.querySelector('[data-testid="tools-table"]')).toBeTruthy();
    // A dash is not a filter: the cells stop being pressable while it is out.
    expect(figures(container)[1].hasAttribute('disabled')).toBe(true);
  });

  it('says the list failed and offers a retry, never an empty table', async () => {
    svc.getAdminTools.mockRejectedValueOnce(new Error('nope'));
    await mount();

    expect(container.querySelector('[data-testid="tools-table"]')).toBeNull();
    expect(container.textContent).toContain(i18n.t('tools:error.lead'));

    svc.getAdminTools.mockResolvedValue(page(TOOLS, 214));
    click(buttonByText(container, i18n.t('tools:retry')));
    await flush();
    expect(container.querySelector('[data-testid="tools-table"]')).toBeTruthy();
  });

  it('tells a 403 apart from a breakage: no retry button on a permissions wall', async () => {
    svc.getAdminTools.mockRejectedValueOnce(new ApiError(403, 'forbidden'));
    await mount();

    expect(container.textContent).toContain(i18n.t('tools:forbidden.lead'));
    expect(buttonByText(container, i18n.t('tools:retry'))).toBeUndefined();
  });

  it('turns the worker filter into a capsule with their name and an ✕', async () => {
    await mount();
    const workerSelect = container.querySelector<HTMLSelectElement>(`select[aria-label="${i18n.t('tools:filter.worker')}"]`)!;
    select(workerSelect, '31');
    await flush();

    expect(container.textContent).toContain(i18n.t('tools:filter.workerOn', { name: 'Édgar Xocop' }));
    expect(container.textContent).toContain(i18n.t('tools:filter.workerNote'));
    expect(svc.getAdminTools).toHaveBeenLastCalledWith(expect.objectContaining({ assignedToId: 31 }));

    click(container.querySelector(`button[aria-label="${i18n.t('common:buttons.close')}"]`));
    await flush();
    expect(svc.getAdminTools).toHaveBeenLastCalledWith(expect.objectContaining({ assignedToId: undefined }));
  });

  it('searches on the server, debounced, and resets to the first page', async () => {
    await mount();
    type(container.querySelector<HTMLInputElement>('input[data-tools-search]')!, 'PT-014');
    await flush(400);

    expect(svc.getAdminTools).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'PT-014', page: 0 }));
  });

  it('changes the question when it changes tab, and asks the other endpoint', async () => {
    await mount();
    click(buttonByText(container, new RegExp(i18n.t('tools:tab.consumable'))));
    await flush();

    expect(svc.searchConsumables).toHaveBeenCalled();
    expect(container.querySelector('[data-testid="consumables-table"]')).toBeTruthy();
    const values = Array.from(container.querySelector('[data-testid="consumables-figures"]')!.children)
      .map(f => f.querySelector('.tabular-nums')!.textContent);
    expect(values).toEqual(['62', '41', '15', '6']);
  });

  it('names the warehouse user instead of linking to a panel the admin cannot open', async () => {
    await mount();
    click(container.querySelector('[data-testid="tool-row-1"]'));   // pending acceptance: it is out
    await flush();

    expect(document.body.textContent).toContain(i18n.t('tools:detail.warehouseSolves'));
    expect(document.body.textContent).toContain('Sandra Ixcot');
    expect(document.body.textContent).toContain(i18n.t('tools:whoCan'));
  });
});
