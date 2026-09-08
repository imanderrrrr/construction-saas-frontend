// Presupuestos: the screen.
//
// Five of the things the fusion came to fix are checked here, because all five
// were promises the old screens broke:
//
//   · the figures follow the filter, and match the table's own total
//   · the filter survives a change of view; the sort does not
//   · a failed load is a banner that stays, with the figures at an em dash
//   · finance sees the same numbers with nothing to write, and no purple chip
//   · the adjust window sends the amount that was typed

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({
  listProjects: vi.fn(),
  listFinanceProjects: vi.fn(),
  updateProject: vi.fn(),
}));
vi.mock('../../services/projects', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/projects')>()),
  ...svc,
}));

const rest = vi.hoisted(() => ({
  getBranding: vi.fn(),
  getExpenseReport: vi.fn(),
  getFinanceExpenseReport: vi.fn(),
  listAllPayables: vi.fn(),
}));
vi.mock('../../services/branding', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/branding')>()),
  getBranding: rest.getBranding,
}));
vi.mock('../../services/expenses', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/expenses')>()),
  getExpenseReport: rest.getExpenseReport,
  getFinanceExpenseReport: rest.getFinanceExpenseReport,
}));
vi.mock('../../services/finance', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/finance')>()),
  listAllPayables: rest.listAllPayables,
}));

import i18n from '../../../i18n';
import { ApiError } from '../../lib/api';
import type { ProjectResponse } from '../../services/projects';
import { resetTourScope } from '../../lib/tourScope';
import { BudgetsSection } from './BudgetsSection';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const MARISOL = { id: 1, name: 'Grupo Marisol' };
const ANDES = { id: 2, name: 'Inmobiliaria Andes' };

function project(over: Partial<ProjectResponse> & { id: number; name: string }): ProjectResponse {
  return {
    status: 'ACTIVE', clientId: null, client: null, costCode: null,
    originalContractCents: null, changeOrdersTotalCents: 0, revisedContractCents: null,
    contractAmountCents: null, approvedExpensesCents: 0, totalConsumedCents: 0,
    costBudgetCents: null, budgetBaseCents: null, remainingBudgetCents: null,
    invoicedCents: 0, collectedCents: 0, outstandingCents: 0,
    address: null, latitude: null, longitude: null, geofenceRadiusMeters: 200,
    assignedUserIds: [], createdAt: '2026-01-15T00:00:00Z', updatedAt: '2026-09-07T00:00:00Z',
    ...over,
  } as ProjectResponse;
}

/** The sheet's four jobsites. */
const PROJECTS = [
  project({
    id: 4804, name: 'Residencial Sur', clientId: 1, client: MARISOL, costCode: 'CC-2026-004',
    originalContractCents: 200_000_00, changeOrdersTotalCents: 60_000_00, revisedContractCents: 260_000_00,
    costBudgetCents: 120_000_00, budgetBaseCents: 120_000_00, totalConsumedCents: 40_000_00,
    invoicedCents: 255_000_00, collectedCents: 180_000_00, outstandingCents: 75_000_00,
  }),
  project({
    id: 4816, name: 'Ampliación Zona 4', clientId: 2, client: ANDES, costCode: 'CC-2026-014',
    originalContractCents: 140_000_00, revisedContractCents: 140_000_00,
    costBudgetCents: 95_000_00, budgetBaseCents: 95_000_00, totalConsumedCents: 101_300_00,
    invoicedCents: 120_000_00, collectedCents: 60_000_00, outstandingCents: 60_000_00,
  }),
  project({
    id: 4801, name: 'Torre Norte', clientId: 1, client: MARISOL, costCode: 'CC-2026-001',
    originalContractCents: 175_000_00, revisedContractCents: 175_000_00,
    budgetBaseCents: 175_000_00, totalConsumedCents: 25_000_00,
    invoicedCents: 40_000_00, collectedCents: 28_000_00, outstandingCents: 12_000_00,
  }),
  project({
    id: 4812, name: 'Bodega Km 22', clientId: 1, client: MARISOL, costCode: 'CC-2026-009',
    originalContractCents: 90_000_00, revisedContractCents: 90_000_00,
    costBudgetCents: 72_000_00, budgetBaseCents: 72_000_00, totalConsumedCents: 69_100_00,
    invoicedCents: 85_000_00, collectedCents: 85_000_00, outstandingCents: 0,
  }),
];

const page = (content: ProjectResponse[]) => ({
  content, number: 0, size: 200, totalElements: content.length, totalPages: 1,
});

async function flush(ms = 0) {
  await act(async () => { await new Promise(r => setTimeout(r, ms)); });
}
function click(el: Element | null | undefined) {
  if (!el) throw new Error('nothing to click');
  act(() => { (el as HTMLElement).click(); });
}
function setSelect(el: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
  act(() => { setter.call(el, value); el.dispatchEvent(new Event('change', { bubbles: true })); });
}
function setInput(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => { setter.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); });
}

describe('BudgetsSection', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(async () => { await i18n.changeLanguage('es'); });

  beforeEach(() => {
    vi.clearAllMocks();
    resetTourScope();
    svc.listProjects.mockResolvedValue(page(PROJECTS));
    svc.listFinanceProjects.mockResolvedValue(page(PROJECTS));
    svc.updateProject.mockResolvedValue(PROJECTS[0]);
    rest.getBranding.mockResolvedValue({ organizationName: 'Constructora Peña S.A.', hasLogo: false });
    rest.getExpenseReport.mockResolvedValue({ kpis: {}, byProject: [], byWorker: [] });
    rest.getFinanceExpenseReport.mockResolvedValue({ kpis: {}, byProject: [], byWorker: [] });
    rest.listAllPayables.mockResolvedValue([]);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function mount(props: { readOnly?: boolean } = {}) {
    await act(async () => { root.render(<BudgetsSection {...props} />); });
    await flush();
  }

  const selects = () => Array.from(container.querySelectorAll('select')) as HTMLSelectElement[];
  const selectFor = (label: string) => {
    const found = selects().find(s => (s.getAttribute('aria-label') ?? '').toLowerCase().includes(label));
    if (!found) throw new Error(`no select for ${label}: ${selects().map(s => s.getAttribute('aria-label')).join(', ')}`);
    return found;
  };
  const tab = (name: string) =>
    Array.from(container.querySelectorAll('[role="tab"]')).find(t => t.textContent?.trim() === name);
  const text = () => container.textContent ?? '';

  it('opens on the jobsites view with the four figures over every jobsite', async () => {
    await mount();
    expect(text()).toContain('$665,000');   // contrato
    expect(text()).toContain('$287,000');   // presupuesto de costo, 3 de 4
    expect(text()).toContain('$235,400');   // consumido
    expect(text()).toContain('$429,600');   // margen
    expect(container.querySelector('[data-testid="budgets-universe"]')?.textContent)
      .toContain('4 obras activas');
  });

  // The defect that defined the screen: the header kept totalling four
  // jobsites above a table that said "1 project".
  it('makes the report figures obey the filter, and match the table total', async () => {
    await mount();
    click(tab('Reporte'));
    await flush();
    expect(text()).toContain('$500,000');
    expect(text()).toContain('$147,000');

    setSelect(selectFor('cliente'), '1');
    await flush();

    expect(text()).toContain('$380,000');   // facturado, Grupo Marisol
    expect(text()).toContain('$293,000');   // cobrado
    expect(text()).toContain('$87,000');    // por cobrar
    expect(text()).toContain('$134,100');   // consumido
    expect(text()).not.toContain('$500,000');
    expect(text()).toContain('Total · 3 obras');
    expect(container.querySelector('[data-testid="budgets-universe"]')?.textContent)
      .toContain('3 de 4 obras');
  });

  it('keeps the filter across a change of view, and lets each view keep its own sort', async () => {
    await mount();
    setSelect(selectFor('cliente'), '1');
    setSelect(selectFor('orden'), 'margin');
    await flush();

    click(tab('Reporte'));
    await flush();
    // The client survives; the sort falls to the report's own default.
    expect(selectFor('cliente').value).toBe('1');
    expect(selectFor('orden').value).toBe('outstanding');

    setSelect(selectFor('orden'), 'consumed');
    click(tab('Obras'));
    await flush();
    expect(selectFor('cliente').value).toBe('1');
    expect(selectFor('orden').value).toBe('margin');
  });

  it('says "none matches" with the figures at $0 and how many there are in all', async () => {
    await mount();
    setSelect(selectFor('cliente'), '2');
    setSelect(selectFor('riesgo'), 'no-cost-budget');
    await flush();
    expect(text()).toContain('Ninguna obra coincide');
    expect(text()).toContain('Hay 4 obras en total');
    expect(text()).toContain('$0');
  });

  // A toast fades and leaves a blank table that reads as "you have no
  // jobsites". This one stays, and the figures do not pretend to a total.
  it('shows a banner with retry when the load fails, and the figures fall to an em dash', async () => {
    svc.listProjects.mockRejectedValueOnce(new ApiError(504, 'gateway timeout', undefined, 'TIMEOUT'));
    await mount();

    expect(text()).toContain('No se pudieron cargar los presupuestos');
    expect(text()).toContain('—');
    expect(text()).toContain('/api/v1/admin/projects');
    expect(container.querySelector('table')).toBeNull();

    const retry = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.trim() === 'Reintentar');
    click(retry);
    await flush();
    expect(text()).toContain('$665,000');
  });

  it('gives finance the same numbers, nothing to write and no purple chip', async () => {
    await mount({ readOnly: true });
    expect(svc.listFinanceProjects).toHaveBeenCalled();
    expect(svc.listProjects).not.toHaveBeenCalled();
    expect(text()).toContain('$665,000');
    expect(text()).toContain('Solo lectura · finanzas');

    expect(container.querySelector('[aria-label*="Acciones de"]')).toBeNull();
    expect(container.innerHTML).not.toContain('purple');
  });

  it('leaves the export to the report view, where the document is', async () => {
    await mount();
    expect(text()).not.toContain('Exportar');
    click(tab('Reporte'));
    await flush();
    expect(text()).toContain('Exportar');
  });

  it('hands the report view its own tour key, one per role', async () => {
    await mount();
    click(tab('Reporte'));
    await flush();
    expect(container.querySelector('[data-tour="sec.budgets-reporte.vista"]')).not.toBeNull();
    expect(container.querySelector('[data-tour="sec.budgets-reporte.reparto"]')).not.toBeNull();

    await mount({ readOnly: true });
    click(tab('Reporte'));
    await flush();
    expect(container.querySelector('[data-tour="sec.budgets-reporte-finanzas.cobro"]')).not.toBeNull();
  });

  describe('the adjust window', () => {
    // Through the detail drawer, which is the other way in and does not need
    // a pointer event to open a Radix menu.
    async function openAdjust() {
      await mount();
      const row = Array.from(container.querySelectorAll('[role="button"]'))
        .find(el => el.textContent?.includes('Torre Norte'));
      click(row);
      await flush();
      const adjust = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent?.trim() === 'Ajustar');
      click(adjust);
      await flush();
    }
    const field = (id: string) => document.querySelector(`#${id}`) as HTMLInputElement;

    // Typing $200,000 on a jobsite with $25,000 spent used to save $175,000,
    // with a success toast and no warning: the screen sent `new − spent` into
    // a field the backend reads as the new original contract.
    it('sends the amount that was typed, into the cost budget', async () => {
      await openAdjust();
      setInput(field('bt-adjust-cost'), '200000');
      await flush();

      const save = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent?.trim() === 'Guardar ajuste');
      click(save);
      await flush();

      expect(svc.updateProject).toHaveBeenCalledWith(4801, { costBudgetCents: 200_000_00 });
    });

    it('leaves the contract alone when only the cost budget moved', async () => {
      await openAdjust();
      setInput(field('bt-adjust-cost'), '200000');
      await flush();
      const save = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent?.trim() === 'Guardar ajuste');
      click(save);
      await flush();

      const [, payload] = svc.updateProject.mock.calls[0];
      expect(payload).not.toHaveProperty('contractAmountCents');
    });

    it('sends the contract as the new original, not as a remainder', async () => {
      await openAdjust();
      setInput(field('bt-adjust-contract'), '250000');
      await flush();
      const save = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent?.trim() === 'Guardar ajuste');
      click(save);
      await flush();

      expect(svc.updateProject).toHaveBeenCalledWith(4801, { contractAmountCents: 250_000_00 });
    });

    // The server has no column for a reason, so the window does not ask for
    // one — today's demands ten characters, promises they are stored, drops
    // them, and writes "admin" as the author of every row.
    it('asks for no reason, no dates and no notes', async () => {
      await openAdjust();
      expect(document.querySelector('textarea')).toBeNull();
      expect(document.querySelector('input[type="date"]')).toBeNull();
    });

    it('allows a cost budget below what has been spent, with a warning', async () => {
      await openAdjust();
      setInput(field('bt-adjust-cost'), '10000');
      await flush();

      expect(document.body.textContent).toContain('Ya has gastado');
      const save = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent?.trim() === 'Guardar ajuste') as HTMLButtonElement;
      expect(save.disabled).toBe(false);
    });

    // Cancelling used to leave the typed text behind, and so did saving: the
    // window kept the strings it was seeded with the first time.
    it('re-seeds the fields every time it opens', async () => {
      await openAdjust();
      setInput(field('bt-adjust-cost'), '999999');
      await flush();

      const cancel = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent?.trim() === 'Cancelar');
      click(cancel);
      await flush();

      const row = Array.from(container.querySelectorAll('[role="button"]'))
        .find(el => el.textContent?.includes('Torre Norte'));
      click(row);
      await flush();
      const adjust = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent?.trim() === 'Ajustar');
      click(adjust);
      await flush();

      // Torre Norte has no cost budget, so the field comes back empty.
      expect(field('bt-adjust-cost').value).toBe('');
      expect(field('bt-adjust-contract').value).toBe('175,000.00');
    });

    it('saves nothing when nothing changed', async () => {
      await openAdjust();
      const save = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent?.trim() === 'Guardar ajuste') as HTMLButtonElement;
      expect(save.disabled).toBe(true);
    });
  });
});
