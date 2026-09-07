// Reporte de herramientas: the screen.
//
// Three of the four things this redesign came to fix are checked here, because
// all three were promises the old screen made and broke: the percentage column
// adds to 100 with the sixth state in it, filtering asks the server for the
// whole report again instead of hiding rows, and the export no longer sends a
// document that contradicts the screen it sits on.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({ getToolReport: vi.fn(), getMissingTools: vi.fn() }));
vi.mock('../../services/toolReport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/toolReport')>()),
  ...svc,
}));

const wh = vi.hoisted(() => ({ searchConsumables: vi.fn() }));
vi.mock('../../services/warehouse', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/warehouse')>()),
  searchConsumables: wh.searchConsumables,
}));

const rest = vi.hoisted(() => ({ getBranding: vi.fn(), listProjects: vi.fn() }));
vi.mock('../../services/branding', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/branding')>()),
  getBranding: rest.getBranding,
}));
vi.mock('../../services/projects', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/projects')>()),
  listProjects: rest.listProjects,
}));

import i18n from '../../../i18n';
import { ApiError } from '../../lib/api';
import type { ToolReport } from '../../services/toolReport';
import { ToolReportSection } from './ToolReportSection';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const page = <T,>(content: T[], totalElements = content.length, size = 20) => ({
  content, page: 0, size, totalElements, totalPages: Math.max(1, Math.ceil(totalElements / size)),
});

/** The sheet's own inventory: 214 tools whose six states add up. */
const REPORT: ToolReport = {
  computedAt: '2026-09-07T20:32:00Z',
  totalInCompany: 214,
  total: 214,
  byStatus: [
    { status: 'Available', count: 126 },
    { status: 'Assigned', count: 61 },
    { status: 'Pending Acceptance', count: 14 },
    { status: 'In Review', count: 7 },
    { status: 'Damaged', count: 4 },
    { status: 'Lost', count: 2 },
  ],
  byCategory: [
    { category: 'Power Tools', count: 68, out: 24 },
    { category: 'Hand Tools', count: 74, out: 21 },
    { category: 'Measurement', count: 26, out: 11 },
    { category: 'Safety Equipment', count: 31, out: 12 },
    { category: 'Heavy Machinery', count: 15, out: 7 },
  ],
  outOfWarehouse: 75,
  avgDaysOut: 8.4,
  missing: { total: 21, unsigned: 14, unsignedOver48h: 5, overdue: 7, oldestDays: 57 },
  byProject: [
    { projectId: 1, project: 'Torre Zona 14', out: 34, unsigned: 6 },
    { projectId: 2, project: 'Residencial San Cristóbal', out: 27, unsigned: 5 },
    { projectId: 3, project: 'Bodega Villa Nueva', out: 14, unsigned: 3 },
  ],
  byWorker: [
    { workerId: 1, worker: 'Édgar Xocop', out: 9, unsigned: 2, oldestDays: 14 },
    { workerId: 2, worker: 'Fredy Cotí', out: 7, unsigned: 1, oldestDays: 57 },
  ],
  supplies: {
    total: 38, inStock: 31, lowStock: 5, outOfStock: 2, dispatches: 142,
    topUsed: [{ consumableId: 1, code: 'CS-018', name: 'Guantes de cuero', unit: 'par', quantity: 96 }],
  },
};

const MISSING = [
  { toolId: 3, code: 'MP-003', name: 'Placa compactadora Wacker WP1550', category: 'Heavy Machinery', status: 'Assigned', worker: 'Fredy Cotí', project: 'Residencial San Cristóbal', outSince: '2026-07-12T15:00:00Z', daysOut: 57, unsigned: false },
  { toolId: 9, code: 'PT-014', name: 'Rotomartillo Bosch GBH 2-26', category: 'Power Tools', status: 'Pending Acceptance', worker: 'Édgar Xocop', project: 'Torre Zona 14', outSince: '2026-09-05T22:40:00Z', daysOut: 2, unsigned: true },
];

async function flush(ms = 0) {
  await act(async () => { await new Promise(r => setTimeout(r, ms)); });
}
function click(el: Element | null | undefined) {
  if (!el) throw new Error('nothing to click');
  act(() => { (el as HTMLElement).click(); });
}
function select(el: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
  act(() => { setter.call(el, value); el.dispatchEvent(new Event('change', { bubbles: true })); });
}

describe('ToolReportSection', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(async () => { await i18n.changeLanguage('es'); });

  beforeEach(async () => {
    vi.clearAllMocks();
    svc.getToolReport.mockResolvedValue(REPORT);
    svc.getMissingTools.mockResolvedValue(page(MISSING, 21));
    wh.searchConsumables.mockResolvedValue(page([]));
    rest.getBranding.mockResolvedValue({ organizationName: 'Constructora Andes', hasLogo: false });
    rest.listProjects.mockResolvedValue(page([{ id: 1, name: 'Torre Zona 14' }, { id: 2, name: 'Residencial San Cristóbal' }]));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function mount(onNavigate = vi.fn()) {
    await act(async () => { root.render(<ToolReportSection onNavigate={onNavigate} />); });
    await flush();
    return onNavigate;
  }

  it('draws the six states and a percentage column that adds to 100,0', async () => {
    await mount();

    const rows = container.querySelectorAll('[data-testid^="status-row-"]');
    expect(rows.length).toBe(6);
    expect(container.querySelector('[data-testid="status-row-Pending-Acceptance"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="share-total"]')!.textContent).toBe('100,0');
  });

  it('shows the sixth figure — the one that was missing — beside the other five', async () => {
    await mount();

    const figures = container.querySelector('[data-testid="report-figures"]')!;
    // The total plus the six states.
    expect(figures.children.length).toBe(7);
    expect(figures.textContent).toContain('14');
    expect(figures.textContent).toContain(i18n.t('admin:toolReport.pending.note'));
  });

  it('says what the report covers, and puts the unit inside the figure', async () => {
    await mount();

    expect(container.querySelector('[data-testid="report-universe"]')!.textContent).toContain('214');
    // "8,4 días", not "8.4 days": the number and its unit are translated together.
    expect(container.textContent).toContain('8,4 días');
    expect(container.textContent).not.toContain('8.4 days');
  });

  it('asks the server again when a filter changes, instead of hiding rows', async () => {
    await mount();
    expect(svc.getToolReport).toHaveBeenLastCalledWith({ category: undefined, status: undefined, projectId: undefined });

    svc.getToolReport.mockResolvedValueOnce({
      ...REPORT,
      total: 68,
      byStatus: [
        { status: 'Available', count: 33 }, { status: 'Assigned', count: 24 },
        { status: 'Pending Acceptance', count: 6 }, { status: 'In Review', count: 3 },
        { status: 'Damaged', count: 2 }, { status: 'Lost', count: 0 },
      ],
    });
    select(container.querySelector<HTMLSelectElement>(`select[aria-label="${i18n.t('admin:toolReport.filter.category')}"]`)!, 'Power Tools');
    await flush();

    expect(svc.getToolReport).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'Power Tools' }));
    expect(svc.getMissingTools).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'Power Tools' }), 0, 20);
    // Recalculated over 68, not over 214 — and still adding to 100,0.
    expect(container.querySelector('[data-testid="share-total"]')!.textContent).toBe('100,0');
    expect(container.querySelector('[data-testid="filter-note"]')!.textContent)
      .toContain(i18n.t('admin:toolReport.filter.on', { count: 68, total: 214 }));
    // A state with no rows stays, at zero.
    expect(container.querySelector('[data-testid="status-row-Lost"]')!.textContent).toContain('0,0');
  });

  it('keeps the export off and says what is happening to it', async () => {
    await mount();

    const pdf = Array.from(container.querySelectorAll('button')).find(b => b.textContent === i18n.t('admin:toolReport.export.pdf'))!;
    const excel = Array.from(container.querySelectorAll('button')).find(b => b.textContent === i18n.t('admin:toolReport.export.excel'))!;
    expect(pdf.disabled).toBe(true);
    expect(excel.disabled).toBe(true);
    expect(container.textContent).toContain(i18n.t('admin:toolReport.export.rebuilding'));
  });

  it('carries the two reasons and the list of what has not come back', async () => {
    await mount();

    const block = container.querySelector('[data-testid="report-missing"]')!;
    expect(block.querySelector('[data-testid="missing-count"]')!.textContent).toBe('21');
    expect(block.textContent).toContain(i18n.t('admin:toolReport.missing.unsigned.note', { count: 5 }));
    expect(block.textContent).toContain(i18n.t('admin:toolReport.missing.overdue.note', { count: 57 }));
    expect(block.querySelector('[data-testid="missing-row-3"]')).toBeTruthy();
    expect(block.textContent).toContain(i18n.t('admin:toolReport.missing.unsignedFor', { count: 2 }));
  });

  it('reports supplies whole, whatever the tool filter says', async () => {
    await mount();

    expect(container.querySelector('[data-testid="supplies-figures"]')!.textContent).toContain('38');
    expect(container.textContent).toContain(i18n.t('admin:toolReport.supplies.categoryNote'));

    select(container.querySelector<HTMLSelectElement>(`select[aria-label="${i18n.t('admin:toolReport.filter.category')}"]`)!, 'Hand Tools');
    await flush();
    // The supplies figures come from the same report, and the server sends
    // them whole: the block does not narrow them by a tool category.
    expect(container.querySelector('[data-testid="supplies-figures"]')!.textContent).toContain('38');
  });

  it('offers a retry when the report fails, with the code out of the headline', async () => {
    svc.getToolReport.mockRejectedValueOnce(new ApiError(500, 'boom'));
    await mount();

    expect(container.textContent).toContain(i18n.t('admin:toolReport.error.word'));
    expect(container.querySelector('[data-testid="report-figures"]')).toBeNull();
    expect(container.querySelector('summary')!.textContent).toBe(i18n.t('admin:toolReport.error.support'));

    svc.getToolReport.mockResolvedValue(REPORT);
    click(Array.from(container.querySelectorAll('button')).find(b => b.textContent === i18n.t('admin:toolReport.retry')));
    await flush();
    expect(container.querySelector('[data-testid="report-figures"]')).toBeTruthy();
  });

  it('shows a wall with no buttons on a 403, because there is nowhere to send them', async () => {
    svc.getToolReport.mockRejectedValueOnce(new ApiError(403, 'forbidden'));
    await mount();

    expect(container.textContent).toContain(i18n.t('admin:toolReport.forbidden.lead'));
    expect(container.querySelectorAll('button').length).toBe(0);
  });

  it('sends an empty inventory to Herramientas instead of drawing empty tables', async () => {
    svc.getToolReport.mockResolvedValue({
      ...REPORT,
      total: 0, totalInCompany: 0, outOfWarehouse: 0, avgDaysOut: null,
      byStatus: REPORT.byStatus.map(s => ({ ...s, count: 0 })),
      byCategory: REPORT.byCategory.map(c => ({ ...c, count: 0, out: 0 })),
      missing: { total: 0, unsigned: 0, unsignedOver48h: 0, overdue: 0, oldestDays: null },
      byProject: [], byWorker: [],
    });
    const onNavigate = await mount();

    expect(container.textContent).toContain(i18n.t('admin:toolReport.empty.none.lead'));
    click(Array.from(container.querySelectorAll('button')).find(b => b.textContent === i18n.t('admin:toolReport.goTools')));
    expect(onNavigate).toHaveBeenCalledWith('tool-inventory');
  });
});
