// BuildTrack — el Reporte de gastos.
//
// Lo que se fija aquí es aquello por lo que se rediseñó la pantalla: que las
// dos columnas dejen de imprimir la misma cifra, que los estados sean dinero y
// no cuentas de gastos, que una obra sin presupuesto lo diga en vez de fingir
// un 0 %, que los totales de trabajadores sean los del informe y no los de la
// página visible, que los filtros se apliquen solos —sin pastilla verde— y que
// un fallo de carga no se disfrace de «no hay gastos».

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, o?: Record<string, unknown>) => (o?.count != null ? `${key}:${o.count}` : key),
    i18n: { language: 'es', resolvedLanguage: 'es' },
  }),
  Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('../../services/projects', () => ({
  listProjects: () => Promise.resolve({ content: [{ id: 1, name: 'Torre Corporativa Zona 10' }] }),
}));
vi.mock('../../services/branding', () => ({ tenantCompanyName: () => Promise.resolve('Constructora Andes') }));

const getExpenseReport = vi.fn();
const exportExpenseReport = vi.fn();
vi.mock('../../services/expenses', () => ({
  getExpenseReport: (...a: unknown[]) => getExpenseReport(...a),
  getFinanceExpenseReport: (...a: unknown[]) => getExpenseReport(...a),
  exportExpenseReport: (...a: unknown[]) => exportExpenseReport(...a),
}));

import { ExpenseReportSection } from './ExpenseReportSection';
import { takeInboxPreset } from '../expenses/preset';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** El hook espera 250 ms antes de pedir: un año tecleado no son cuatro informes. */
async function flush(ms = 320) {
  await act(async () => { await new Promise(r => setTimeout(r, ms)); });
}

const REPORT = {
  generatedAt: '2026-09-14T21:47:00Z',
  kpis: {
    totalApprovedCents: 150_500_000,
    projectCount: 2,
    pendingCents: 431_000,
    pendingCount: 7,
    observedCents: 15_000,
    observedCount: 1,
    rejectedCents: 210_000,
    rejectedCount: 1,
    notPayableCents: 225_000,
    topCategory: 'MATERIALS',
    topCategoryCents: 93_310_000,
    expenseCount: 46,
    avgPerWorkerCents: 410_000,
  },
  byProject: [
    {
      projectId: 1, projectName: 'Torre Corporativa Zona 10',
      approvedCents: 52_300_000, pendingCents: 75_000, observedCents: 0, rejectedCents: 210_000,
      pendingCount: 2, observedCount: 0, rejectedCount: 1,
      costBudgetCents: 388_000_000,
      breakdown: [{ type: 'MATERIALS', count: 21, totalCents: 28_644_000 }],
    },
    {
      projectId: 2, projectName: 'Remodelación Hotel Antigua',
      approvedCents: 14_700_000, pendingCents: 0, observedCents: 0, rejectedCents: 0,
      pendingCount: 0, observedCount: 0, rejectedCount: 0,
      costBudgetCents: null,
      breakdown: [],
    },
  ],
  byCategory: [{ type: 'MATERIALS', count: 21, totalCents: 93_310_000 }],
  trend: {
    months: [
      { month: '2026-08', approvedCents: 139_000_000, partial: false, daysCounted: 31, daysInMonth: 31 },
      { month: '2026-09', approvedCents: 150_500_000, partial: true, daysCounted: 14, daysInMonth: 30 },
    ],
    previousWindow: { dateFrom: '2026-08-01', dateTo: '2026-08-14', approvedCents: 70_200_000 },
  },
  byWorker: [
    {
      workerId: 3, workerName: 'Manuel Ramírez', workerUsername: 'mramirez',
      submittedCount: 18, approvedCount: 14, pendingCount: 2, observedCount: 0, rejectedCount: 0,
      totalApprovedCents: 4_620_000,
    },
  ],
  workerTotals: {
    workerCount: 18, submittedCount: 54, approvedCount: 44,
    pendingCount: 2, observedCount: 1, rejectedCount: 1,
    totalApprovedCents: 150_500_000,
  },
};

describe('Reporte de gastos', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    sessionStorage.clear();
    getExpenseReport.mockReset().mockResolvedValue(REPORT);
    exportExpenseReport.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function render(props: { readOnly?: boolean; onNavigate?: (s: string) => void } = {}) {
    await act(async () => { root.render(<ExpenseReportSection {...props} />); });
    await flush();
  }

  it('las dos columnas de la obra dicen cosas distintas, y los estados son dinero', async () => {
    await render();
    // Aprobado y «del presupuesto» ya no son el mismo número impreso dos veces.
    expect(container.textContent).toContain('$523,000');
    expect(container.textContent).toContain('expenseReport.ofBudget');
    // Y el rechazado de esa obra es $2.100, no un «1».
    expect(container.textContent).toContain('$2,100');
    expect(container.textContent).toContain('expenseReport.state.count:1');
  });

  it('la obra sin presupuesto de costos lo dice, en vez de fingir un 0 %', async () => {
    await render();
    expect(container.textContent).toContain('expenseReport.noBudget');
  });

  it('no hay botón de generar ni pastilla verde: el filtro se aplica solo', async () => {
    await render();
    const labels = [...container.querySelectorAll('button')].map(b => b.textContent ?? '');
    expect(labels.some(l => l.includes('generateReport') || l.includes('Generar'))).toBe(false);
    expect(container.textContent).not.toContain('expenseReport.generated');
    expect(container.textContent).toContain('expenseReport.asOf');

    expect(getExpenseReport).toHaveBeenCalledTimes(1);
    const select = [...container.querySelectorAll('select')][0];
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!;
      setter.call(select, '1');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await flush();
    expect(getExpenseReport).toHaveBeenCalledTimes(2);
    expect(getExpenseReport.mock.calls[1][0]).toMatchObject({ projectId: 1 });
  });

  it('el total de trabajadores es el del informe, no el de la página visible', async () => {
    await render();
    // Una sola fila en pantalla ($46.200) y un total de informe de $1.505.000.
    expect(container.textContent).toContain('$46,200');
    expect(container.textContent).toContain('expenseReport.byWorker.reportTotal');
    expect(container.textContent).toContain('expenseReport.byWorker.pageTotal');
  });

  it('sin trabajadores no pinta encabezados ni una fila de totales en ceros', async () => {
    getExpenseReport.mockResolvedValue({
      ...REPORT,
      byWorker: [],
      workerTotals: { ...REPORT.workerTotals, workerCount: 0, totalApprovedCents: 0 },
    });
    await render();
    expect(container.textContent).toContain('expenseReport.byWorker.emptyWord');
    expect(container.textContent).not.toContain('expenseReport.byWorker.pageTotal');
    expect(container.textContent).not.toContain('expenseReport.byWorker.submitted');
  });

  it('un fallo de carga no se disfraza de «no hay gastos» y apaga la exportación', async () => {
    getExpenseReport.mockRejectedValue(new Error('504 GATEWAY TIMEOUT'));
    await render();
    expect(container.textContent).toContain('expenseReport.loadErrorTitle');
    expect(container.textContent).not.toContain('expenseReport.empty.word');
    const exportBtn = [...container.querySelectorAll('button')]
      .find(b => b.textContent?.includes('expenseReport.export.cta'));
    expect(exportBtn?.disabled, 'no se exporta un informe que no cargó').toBe(true);
    expect(container.textContent).toContain('expenseReport.export.blockedError');
  });

  it('el rango vacío se explica como rango vacío, y ofrece volver a este mes', async () => {
    getExpenseReport.mockResolvedValue({
      ...REPORT,
      kpis: { ...REPORT.kpis, totalApprovedCents: 0, projectCount: 0, pendingCents: 0 },
      byProject: [], byCategory: [],
    });
    await render();
    expect(container.textContent).toContain('expenseReport.empty.rangeTitle');
    expect(container.textContent).toContain('expenseReport.empty.thisMonth');
    expect(container.textContent).not.toContain('expenseReport.loadErrorTitle');
  });

  it('la exportación la pide al servidor con el idioma del panel y los filtros puestos', async () => {
    await render();
    const menu = [...container.querySelectorAll('button')]
      .find(b => b.textContent?.includes('expenseReport.export.cta'))!;
    await act(async () => { menu.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    const pdf = [...container.querySelectorAll('button')]
      .find(b => b.textContent?.includes('expenseReport.export.pdf'))!;
    await act(async () => { pdf.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await flush(0);

    expect(exportExpenseReport).toHaveBeenCalledTimes(1);
    expect(exportExpenseReport.mock.calls[0][0]).toMatchObject({ format: 'pdf', lang: 'es', role: 'admin' });
  });

  it('la cifra pendiente de una obra abre la bandeja con esa obra y ese estado', async () => {
    const onNavigate = vi.fn();
    await render({ onNavigate });
    const link = [...container.querySelectorAll('button')]
      .find(b => b.getAttribute('title') === 'expenseReport.openInbox')!;
    await act(async () => { link.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    expect(onNavigate).toHaveBeenCalledWith('expenses');
    expect(takeInboxPreset()).toMatchObject({ projectId: 1, status: 'PENDING' });
  });

  it('finanzas ve lo mismo, con su chip de solo lectura y su propio endpoint', async () => {
    await render({ readOnly: true });
    expect(container.textContent).toContain('expenseReport.readOnly');
    expect(container.textContent).toContain('$523,000');
  });
});
