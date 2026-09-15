// BuildTrack — Gastos de oficina.
//
// Lo que se fija aquí es aquello por lo que se rediseñó la pantalla: que la
// cifra de dinero sea del servidor y no la suma de la página visible, que el
// mes sea la unidad de navegación, que los fijos que faltan se avisen, que las
// categorías sean texto de la empresa y no claves traducibles, que el buscador
// no dispare una petición por tecla, y que dar de baja nombre el gasto y su
// monto en vez de preguntar «¿eliminar?».

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
vi.mock('../../services/users', () => ({ listActiveUsers: () => Promise.resolve([]) }));
vi.mock('../../services/branding', () => ({ tenantCompanyName: () => Promise.resolve('Constructora Andes') }));

const listOfficeExpenses = vi.fn();
const getOfficeExpenseSummary = vi.fn();
const listOfficeCategories = vi.fn();
const deleteOfficeExpense = vi.fn();
vi.mock('../../services/officeExpenses', () => ({
  listOfficeExpenses: (...a: unknown[]) => listOfficeExpenses(...a),
  getOfficeExpenseSummary: (...a: unknown[]) => getOfficeExpenseSummary(...a),
  listOfficeCategories: (...a: unknown[]) => listOfficeCategories(...a),
  deleteOfficeExpense: (...a: unknown[]) => deleteOfficeExpense(...a),
  createOfficeExpense: vi.fn(() => Promise.resolve({ id: 9 })),
  updateOfficeExpense: vi.fn(() => Promise.resolve({ id: 9 })),
  uploadOfficeReceipt: vi.fn(() => Promise.resolve({ id: 9 })),
  removeOfficeReceipt: vi.fn(() => Promise.resolve({ id: 9 })),
  createOfficeCategory: vi.fn(() => Promise.resolve({})),
  renameOfficeCategory: vi.fn(() => Promise.resolve({})),
  archiveOfficeCategory: vi.fn(() => Promise.resolve({})),
  restoreOfficeCategory: vi.fn(() => Promise.resolve({})),
  deleteOfficeCategory: vi.fn(() => Promise.resolve()),
  officeReceiptUrl: (id: number) => `/api/v1/admin/office-expenses/${id}/receipt`,
}));

import { OfficeExpensesSection } from './OfficeExpensesSection';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** El hook espera 500 ms: un año tecleado no son cuatro peticiones. */
async function flush(ms = 620) {
  await act(async () => { await new Promise(r => setTimeout(r, ms)); });
}

function expense(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    description: 'Resmas de papel y tóner',
    category: 'office_supplies',
    categoryId: 3,
    categoryName: 'Papelería',
    categoryArchived: false,
    amount: 148.5,
    amountCents: 14_850,
    purchaseDate: '2026-09-11',
    purchasedBy: 'Ana Lucía Pérez',
    purchasedByUserId: 7,
    notes: 'Para la impresora de planos',
    recurring: false,
    recurringDay: null,
    receipt: { filename: 'factura.pdf', contentType: 'application/pdf', sizeBytes: 319_488, uploadedAt: '2026-09-11T20:12:00Z' },
    createdBy: 'boss',
    updatedBy: 'boss',
    createdAt: '2026-09-11T20:12:00Z',
    updatedAt: '2026-09-11T20:12:00Z',
    ...over,
  };
}

const SUMMARY = {
  periodCents: 224_725,
  periodCount: 6,
  monthCents: 224_725,
  monthCount: 6,
  previousMonthCents: 391_000,
  yearToDateCents: 2_418_050,
  byCategory: [
    { categoryId: 4, categoryName: 'Equipo tecnológico', totalCents: 124_000, count: 1 },
    { categoryId: 2, categoryName: 'Servicios', totalCents: 41_275, count: 1 },
  ],
  recurringMissing: [
    {
      templateId: 30, description: 'Renta de oficina', categoryId: 1, categoryName: 'Renta',
      lastAmountCents: 220_000, recurringDay: 2, lastPurchaseDate: '2026-08-02',
    },
    {
      templateId: 31, description: 'Internet', categoryId: 2, categoryName: 'Servicios',
      lastAmountCents: 44_500, recurringDay: 4, lastPurchaseDate: '2026-08-04',
    },
  ],
  recurringSettledCount: 2,
  recurringExpectedCents: 340_775,
};

const CATEGORIES = [
  { id: 1, name: 'Renta', seeded: true, archived: false, expenseCount: 7, yearToDateCents: 1_540_000 },
  { id: 2, name: 'Servicios', seeded: true, archived: false, expenseCount: 9, yearToDateCents: 201_475 },
  { id: 3, name: 'Papelería', seeded: true, archived: false, expenseCount: 11, yearToDateCents: 59_625 },
  { id: 9, name: 'Caja chica', seeded: false, archived: true, expenseCount: 3, yearToDateCents: 41_000 },
];

describe('Gastos de oficina', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    listOfficeExpenses.mockReset().mockResolvedValue({
      content: [expense()], page: 0, size: 20, totalElements: 6, totalPages: 1,
    });
    getOfficeExpenseSummary.mockReset().mockResolvedValue(SUMMARY);
    listOfficeCategories.mockReset().mockResolvedValue(CATEGORIES);
    deleteOfficeExpense.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function render() {
    await act(async () => { root.render(<OfficeExpensesSection />); });
    await flush();
  }

  it('la cifra del mes es la del servidor, no la suma de la fila visible', async () => {
    // Una sola fila de $148,50 en pantalla y un mes de $2.247,25 en el servidor.
    await render();
    expect(container.textContent).toContain('$2,247');
    expect(container.textContent).toContain('officeExpenses.summary.fromServer');
    // Y ya no existe la cifra que sumaba la página.
    expect(container.textContent).not.toContain('pageTotal');
  });

  it('el mes es la unidad y se puede retroceder', async () => {
    await render();
    expect(getOfficeExpenseSummary).toHaveBeenCalledTimes(1);
    const first = getOfficeExpenseSummary.mock.calls[0][0];
    expect(first.from.slice(-2)).toBe('01');

    const back = [...container.querySelectorAll('button')].find(b => b.textContent?.includes('agosto'));
    expect(back, 'el botón del mes anterior no se pintó').toBeDefined();
    await act(async () => { back!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await flush();

    expect(getOfficeExpenseSummary).toHaveBeenCalledTimes(2);
    const second = getOfficeExpenseSummary.mock.calls[1][0];
    expect(second.from < first.from, 'el segundo informe es de un mes anterior').toBe(true);
  });

  it('los fijos que faltan se avisan con su nombre', async () => {
    await render();
    expect(container.textContent).toContain('officeExpenses.recurring.figureLabel');
    expect(container.textContent).toContain('Renta de oficina');
    expect(container.textContent).toContain('Internet');
  });

  it('las categorias se pintan con el nombre de la empresa, sin traducir', async () => {
    await render();
    // El nombre viene de la fila, no de una clave `officeExpense.category.*`.
    expect(container.textContent).toContain('Papelería');
    expect(container.textContent).toContain('Equipo tecnológico');
    expect(container.textContent).not.toContain('officeExpense.category');
  });

  it('el filtro de categoria ofrece las activas y agrupa las archivadas aparte', async () => {
    await render();
    const select = [...container.querySelectorAll('select')]
      .find(s => [...s.options].some(o => o.textContent === 'Renta'));
    expect(select, 'el filtro de categorías no se pintó').toBeDefined();
    const group = select!.querySelector('optgroup');
    expect(group?.label).toBe('officeExpenses.categories.archivedLabel');
    expect(group?.textContent).toContain('Caja chica');
  });

  it('el buscador no dispara una peticion por tecla', async () => {
    await render();
    expect(listOfficeExpenses).toHaveBeenCalledTimes(1);

    const input = [...container.querySelectorAll('input')]
      .find(i => i.getAttribute('placeholder') === 'officeExpenses.filters.searchPlaceholder');
    expect(input, 'el buscador no se pintó').toBeDefined();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
    for (const text of ['s', 'si', 'sil', 'sill', 'silla']) {
      await act(async () => {
        setter.call(input!, text);
        input!.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
    // Sin esperar el retardo: ninguna petición nueva todavía.
    expect(listOfficeExpenses).toHaveBeenCalledTimes(1);
    await flush();
    expect(listOfficeExpenses).toHaveBeenCalledTimes(2);
    expect(listOfficeExpenses.mock.calls[1][0].search).toBe('silla');
  });

  it('dar de baja nombra el gasto y su monto, y dice que la fila queda', async () => {
    await render();
    const del = [...container.querySelectorAll('button')]
      .find(b => b.textContent === 'officeExpenses.table.delete');
    expect(del, 'el botón de baja no se pintó').toBeDefined();
    await act(async () => { del!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    const text = document.body.textContent ?? '';
    expect(text).toContain('Resmas de papel y tóner');
    expect(text).toContain('$149');
    expect(text).toContain('officeExpenses.delete.trail');
    // Y no promete un borrado definitivo, que es lo que decía antes.
    expect(text).not.toContain('no se puede deshacer');
  });

  it('un fallo de la lista no esconde las cifras, y cada uno se reintenta solo', async () => {
    listOfficeExpenses.mockRejectedValue(new Error('503 SERVICE UNAVAILABLE'));
    await render();
    expect(container.textContent).toContain('officeExpenses.loadErrorTitle');
    // Las cifras llegaron: siguen en pantalla.
    expect(container.textContent).toContain('$2,247');
  });

  it('el mes vacio se explica como mes vacio, no como un filtro', async () => {
    listOfficeExpenses.mockResolvedValue({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 1 });
    await render();
    expect(container.textContent).toContain('officeExpenses.empty.monthTitle');
    expect(container.textContent).not.toContain('officeExpenses.empty.filterTitle');
  });

  it('la primera vez no habla de filtros', async () => {
    listOfficeExpenses.mockResolvedValue({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 1 });
    getOfficeExpenseSummary.mockResolvedValue({
      ...SUMMARY,
      periodCents: 0, periodCount: 0, monthCents: 0, previousMonthCents: 0, yearToDateCents: 0,
      byCategory: [], recurringMissing: [], recurringSettledCount: 0, recurringExpectedCents: 0,
    });
    await render();
    expect(container.textContent).toContain('officeExpenses.empty.firstTitle');
  });
});
