// BuildTrack — la bandeja de gastos.
//
// Lo que se fija aquí es exactamente aquello por lo que se rediseñó la
// pantalla: que ninguna cifra salga de la página cargada, que el botón de lote
// hable del filtro y lo mande, que un gasto sin recibo sea un estado y no un
// visor roto, que el sobregiro avise sin bloquear, y que un fallo de carga no
// se disfrace de «no hay gastos» — de esta lista se aprueba dinero.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, o?: Record<string, unknown>) => (o?.count != null ? `${key}:${o.count}` : key), i18n: { language: 'es' } }),
  Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));
vi.mock('../../services/users', () => ({ listActiveUsers: () => Promise.resolve([]) }));
vi.mock('../../services/projects', () => ({ listProjects: () => Promise.resolve({ content: [] }) }));
vi.mock('../../services/branding', () => ({ tenantCompanyName: () => Promise.resolve('Constructora Andes') }));

const getAdminExpenses = vi.fn();
const getAdminSummary = vi.fn();
const adminBatchApprove = vi.fn();
vi.mock('../../services/expenses', () => ({
  getAdminExpenses: (...a: unknown[]) => getAdminExpenses(...a),
  getAdminSummary: (...a: unknown[]) => getAdminSummary(...a),
  getFinanceExpenses: (...a: unknown[]) => getAdminExpenses(...a),
  getFinanceSummary: (...a: unknown[]) => getAdminSummary(...a),
  adminBatchApprove: (...a: unknown[]) => adminBatchApprove(...a),
  approveExpense: vi.fn(() => Promise.resolve({})),
  observeExpense: vi.fn(() => Promise.resolve({})),
  rejectExpense: vi.fn(() => Promise.resolve({})),
}));

import { ExpensesSection } from './ExpensesSection';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function flush() {
  await act(async () => { await new Promise(r => setTimeout(r, 0)); });
}

function expense(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1, workerId: 3, workerName: 'Manuel Ramírez', workerUsername: 'mramirez',
    projectId: 1, projectName: 'Residencial Vista Hermosa II',
    expenseType: 'MATERIALS', amountCents: 124_000, expenseDate: '2026-09-11',
    description: 'Cemento y arena', status: 'PENDING',
    receiptUrl: '/api/v1/expenses/1/receipt',
    reviewerId: null, reviewerName: null, reviewerComment: null, reviewedAt: null,
    resubmittedAt: null, createdAt: '2026-09-11T15:00:00Z', updatedAt: '2026-09-11T15:00:00Z',
    projectBudget: { baseCents: 1_720_000_00, consumedCents: 1_184_500_00, remainingCents: 535_500_00 },
    ...over,
  };
}

const SUMMARY = {
  totalSubmitted: 7, totalApprovedCents: 135_000, pendingCount: 3, observedCount: 1, rejectedCount: 1,
  approvedCount: 2, pendingCents: 183_000, observedCents: 15_000, rejectedCents: 210_000,
};

describe('Gastos — la bandeja', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    getAdminExpenses.mockReset();
    getAdminSummary.mockReset().mockResolvedValue(SUMMARY);
    adminBatchApprove.mockReset().mockResolvedValue({ approvedCount: 1, skipped: [] });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function render(props: { readOnly?: boolean } = {}) {
    await act(async () => { root.render(<ExpensesSection {...props} />); });
    await flush();
  }

  function page(content: unknown[]) {
    return Promise.resolve({ content, page: 0, size: 50, totalElements: content.length, totalPages: 1 });
  }

  it('las cifras de cabecera son las del servidor, no las de la página cargada', async () => {
    // Una sola fila de $1.240 en pantalla, y un pendiente de $1.830 en el rango:
    // la cabecera tiene que decir el del servidor. Sumar lo visible es
    // exactamente el defecto que se está corrigiendo.
    getAdminExpenses.mockImplementation(() => page([expense()]));
    await render();
    expect(container.textContent).toContain('$1,830.00');
    expect(container.textContent).not.toContain('$1,240.00' + 'Pendiente');
  });

  it('el botón de lote dice cuántos hay y manda los filtros al servidor', async () => {
    getAdminExpenses.mockImplementation(() => page([expense(), expense({ id: 2, amountCents: 38_000 })]));
    await render();

    const batch = [...container.querySelectorAll('button')]
      .find(b => b.textContent?.includes('expenses.batch.cta'));
    expect(batch, 'el botón del lote no se pintó').toBeDefined();

    await act(async () => { batch!.click(); });
    await flush();
    const confirm = [...document.querySelectorAll('button')]
      .find(b => b.textContent?.includes('expenses.batch.confirm'));
    await act(async () => { confirm!.click(); });
    await flush();

    expect(adminBatchApprove).toHaveBeenCalledTimes(1);
    const scope = adminBatchApprove.mock.calls[0][0] as Record<string, unknown>;
    expect(scope.dateFrom, 'el lote tiene que ir con el filtro de la pantalla').toBeTruthy();
    expect(scope.dateTo).toBeTruthy();
  });

  it('aprobar en rojo avisa y pide una casilla, pero no bloquea', async () => {
    // La decisión del cliente: el presupuesto mide, no es una compuerta. El
    // gasto entra y el saldo queda negativo — pero no sin que lo sepa quien
    // aprueba, y eso hoy solo existía en el log del servidor.
    getAdminExpenses.mockImplementation((p: { status?: string }) =>
      page(p?.status === 'PENDING'
        ? [expense({ amountCents: 21_000, projectBudget: { baseCents: 400_000, consumedCents: 399_870, remainingCents: 13_000 } })]
        : []));
    await render();

    const approve = [...container.querySelectorAll('button')]
      .find(b => b.textContent?.includes('expenses.approve.cta'));
    await act(async () => { approve!.click(); });
    await flush();

    expect(document.body.textContent).toContain('expenses.approve.overdraft');
    const confirm = [...document.querySelectorAll('button')]
      .find(b => b.textContent?.includes('expenses.approve.confirmOverdraft')) as HTMLButtonElement;
    expect(confirm.disabled, 'sin marcar la casilla no se aprueba').toBe(true);

    const box = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await act(async () => { box.click(); });
    await flush();
    const after = [...document.querySelectorAll('button')]
      .find(b => b.textContent?.includes('expenses.approve.confirmOverdraft')) as HTMLButtonElement;
    expect(after.disabled, 'un clic más, ninguna prohibición').toBe(false);
  });

  it('un gasto sin recibo lo dice y no ofrece el visor', async () => {
    getAdminExpenses.mockImplementation(() => page([expense({ receiptUrl: null })]));
    await render();
    expect(container.textContent).toContain('expenses.receipt.none');
    const viewer = [...container.querySelectorAll('button')]
      .find(b => b.getAttribute('title') === 'expenses.receipt.view');
    expect(viewer, 'no se puede ofrecer abrir una foto que no existe').toBeUndefined();
  });

  it('un fallo de carga no se disfraza de «no hay gastos»', async () => {
    getAdminExpenses.mockRejectedValue(new Error('504 GATEWAY TIMEOUT'));
    await render();
    expect(container.textContent).toContain('expenses.loadErrorTitle');
    expect(container.textContent).not.toContain('expenses.empty.rangeTitle');
    expect(container.textContent).toContain('504 GATEWAY TIMEOUT');
  });

  it('el resumen y la lista fallan por separado', async () => {
    getAdminExpenses.mockImplementation((p: { status?: string }) =>
      page(p?.status === 'PENDING' ? [expense()] : []));
    getAdminSummary.mockRejectedValue(new Error('500'));
    await render();
    // La cola sigue en pie: que no responda el resumen no es motivo para
    // esconder los gastos que sí llegaron.
    expect(container.textContent).toContain('expenses.summaryError');
    expect(container.querySelectorAll('[data-testid="expense-row"]').length).toBe(1);
  });

  it('finanzas no puede revisar ni aprobar en bloque', async () => {
    getAdminExpenses.mockImplementation(() => page([expense({ status: 'APPROVED' })]));
    await render({ readOnly: true });
    const labels = [...container.querySelectorAll('button')].map(b => b.textContent ?? '');
    expect(labels.some(l => l.includes('expenses.approve.cta'))).toBe(false);
    expect(labels.some(l => l.includes('expenses.batch.cta'))).toBe(false);
  });

  it('un gasto que vuelve en las dos consultas se pinta una sola vez', async () => {
    // Pendientes y devueltos se piden por separado y no es atómico: si alguien
    // aprueba entre las dos, el mismo gasto puede venir en ambas.
    getAdminExpenses.mockImplementation(() => page([expense()]));
    await render();
    expect(container.querySelectorAll('[data-testid="expense-row"]').length).toBe(1);
  });

  it('las cuatro anclas del recorrido existen aunque no haya gastos', async () => {
    getAdminExpenses.mockImplementation(() => page([]));
    await render();
    for (const step of ['cifras', 'vistas', 'cola', 'acciones']) {
      expect(
        container.querySelector(`[data-tour="sec.expenses.${step}"]`),
        `falta el ancla ${step}: el recorrido encogería a «1 de 1»`,
      ).not.toBeNull();
    }
  });
});
