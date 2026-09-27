// BuildTrack — the QuickBooks section for a keyboard or a screen reader, and
// the picker's long names (audit B17):
//  - the tab lists (sections, Vincular's lists, Envíos' state filter) follow
//    the ARIA tabs pattern: one tab in the Tab order, arrows / Home / End to
//    move, and a tabpanel named by its tab;
//  - a failed load is an alert; the counters give the term before the value;
//  - the company's capabilities are said in words, not only by colour;
//  - «Cliente:Obra» is shown whole in the picker.
//
// The backend is faked at the HTTP helper, like the tabs' own tests.

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  QuickBooksMappingOverview, QuickBooksOption, QuickBooksPaymentsStatus, QuickBooksStatus, QuickBooksSyncOverview, QuickBooksSyncRow,
} from '../../services/quickbooks';

vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  api: (path: string, init?: RequestInit) => fakeApi(path, init),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { QuickBooksSection } from './QuickBooksSection';
import { QuickBooksMapping } from './QuickBooksMapping';
import { QuickBooksSync } from './QuickBooksSync';
import { ApiError } from '../../lib/api';
import i18n from '../../../i18n';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const BASE = '/api/v1/admin/integrations/quickbooks';

const ACTIVE: QuickBooksStatus = {
  configured: true, environment: 'SANDBOX', state: 'ACTIVE', companyName: 'Constructora Peña S.A.', realmId: '9130000009',
  connectedAt: '2026-09-25T15:00:00Z', connectedBy: 'admin', lastRefreshedAt: '2026-09-25T15:00:00Z',
  refreshTokenExpiresAt: '2027-01-03T15:00:00Z', refreshTokenHardExpiresAt: '2031-09-24T15:00:00Z', lastError: null,
};

const MAPPINGS: QuickBooksMappingOverview = {
  company: {
    connected: true, realmId: '9130000009', companyName: 'Constructora Peña S.A.', plan: 'PLUS', offeringSku: 'QuickBooks Online Plus',
    country: 'US', homeCurrency: 'USD', projectsEnabled: false, classTracking: true, locationTracking: null, expensesByCustomer: true,
    jobTracking: 'SUB_CUSTOMERS', profileReadAt: '2026-09-25T16:00:00Z', directoryRefreshedAt: '2026-09-25T16:00:00Z',
    directoryCounts: { CUSTOMER: 29 },
  },
  clients: [{
    type: 'CLIENT', localKey: '1', localLabel: 'Freeman Sporting Goods', detail: null, link: null, billCount: null, billTotalCents: null,
    suggestion: null,
  }],
  projects: [{
    type: 'PROJECT', localKey: '10', localLabel: '55 Twin Lane', detail: 'Freeman Sporting Goods', link: null, billCount: null,
    billTotalCents: null, suggestion: null,
  }],
  vendors: [], categories: [], invoiceItem: [],
};

const readyRow: QuickBooksSyncRow = {
  type: 'INVOICE', docId: 5, documentType: 'INVOICE', number: 'INV-2026-0005', vendorInvoiceNumber: null,
  party: 'Cliente Demo', projectName: 'Torre Norte', date: '2026-09-25', amountCents: 300_00, state: 'READY',
  reasons: [], linkTabs: [], errorMessage: null, warning: null, deletedHere: false, qboId: null, qboDocNumber: null, qboUrl: null,
  sentAt: null, sentBy: null, syncedAt: null, lastAttemptAt: null, nextAttemptAt: null, skippedBy: null,
  attachmentsTotal: null, attachmentsSent: null,
};

const SYNC: QuickBooksSyncOverview = {
  settings: {
    connected: true, environment: 'SANDBOX', realmId: '9130000009', companyName: 'Constructora Peña S.A.',
    cutoverDate: '2026-09-20', autoSend: false, autoSendChangedBy: null, autoSendChangedAt: null, autoSendIntervalMinutes: 2,
    lastRunAt: null, lastRunSummary: null, plan: 'PLUS', expensesByCustomer: true, customTxnNumbers: false, allowDiscount: true,
    usingSalesTax: true, preferencesRead: true,
  },
  summary: { ready: 1, blocked: 2, failed: 0, sent: 0, changed: 0, skipped: 0, closed: 0 },
  rows: [readyRow], page: 0, size: 25, totalElements: 1, totalPages: 1,
};

const PAYMENTS: QuickBooksPaymentsStatus = {
  connected: true, enabled: false, changedBy: null, changedAt: null, intervalMinutes: 60, readAt: null, cursor: null,
  lastError: null, running: false, webhook: { configured: false, url: null, lastEventAt: null, pendingEvents: 0 },
  localPaymentsDocuments: 0, localPaymentsCents: 0, recent: [],
};

const TWIN_LANE: QuickBooksOption = {
  qboId: '9', name: '55 Twin Lane', fullName: 'Freeman Sporting Goods:55 Twin Lane', kind: 'CUSTOMER',
  isProject: false, isSubCustomer: true, accountType: null, active: true,
};

let replies: Record<string, unknown> = {};

async function fakeApi(path: string, init?: RequestInit): Promise<unknown> {
  const key = `${(init?.method ?? 'GET').toUpperCase()} ${path.split('?')[0]}`;
  if (!(key in replies)) throw new Error(`unscripted ${key}`);
  const reply = replies[key];
  if (reply instanceof Error) throw reply;
  return reply;
}

let host: HTMLDivElement;
let root: Root;

async function flush(ms = 0) {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, ms)); });
}

async function render(node: ReactElement) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(node); });
  await flush();
}

function button(label: string, scope: ParentNode = document): HTMLButtonElement | undefined {
  return [...scope.querySelectorAll('button')].find(b => b.textContent?.trim().startsWith(label)) as HTMLButtonElement | undefined;
}

async function click(el: HTMLElement | undefined, what: string) {
  expect(el, what).toBeTruthy();
  await act(async () => { el!.click(); });
  await flush();
}

function tablist(name: string): HTMLElement {
  const list = [...document.querySelectorAll('[role="tablist"]')].find(el => el.getAttribute('aria-label') === name);
  expect(list, name).toBeTruthy();
  return list as HTMLElement;
}

const tabs = (list: HTMLElement) => [...list.querySelectorAll('[role="tab"]')] as HTMLElement[];
const selected = (list: HTMLElement) => tabs(list).find(t => t.getAttribute('aria-selected') === 'true')!;

/** A key pressed on the focused tab (it bubbles to the list, as in a browser). */
async function key(list: HTMLElement, k: string) {
  const target = list.contains(document.activeElement) ? document.activeElement! : list;
  await act(async () => { target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); });
  await flush();
}

/** The panel a tab list shows: the tabpanel named by its selected tab. */
function panelOf(list: HTMLElement): HTMLElement {
  const tab = selected(list);
  const panel = document.getElementById(tab.getAttribute('aria-controls')!);
  expect(panel?.getAttribute('role')).toBe('tabpanel');
  expect(panel?.getAttribute('aria-labelledby')).toBe(tab.id);
  return panel!;
}

beforeEach(async () => {
  await i18n.changeLanguage('es');
  replies = {
    [`GET ${BASE}`]: ACTIVE,
    [`GET ${BASE}/mappings`]: MAPPINGS,
    [`GET ${BASE}/sync`]: SYNC,
    [`GET ${BASE}/payments`]: PAYMENTS,
  };
});

afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  document.body.innerHTML = '';
});

describe('the tab lists', () => {
  it('Vincular / Envíos / Pagos: one tab in the Tab order, arrows, Home and End move and select, the panel is named by its tab', async () => {
    await render(<QuickBooksSection />);
    const list = tablist('Secciones de QuickBooks');

    expect(tabs(list).map(t => t.tabIndex)).toEqual([0, -1, -1]);
    expect(panelOf(list).textContent).toContain('Freeman Sporting Goods');

    selected(list).focus();
    await key(list, 'ArrowRight');
    expect(selected(list).textContent).toBe('Envíos');
    expect(document.activeElement).toBe(selected(list));
    expect(tabs(list).map(t => t.tabIndex)).toEqual([-1, 0, -1]);
    expect(panelOf(list).textContent).toContain('INV-2026-0005');

    await key(list, 'End');
    expect(selected(list).textContent).toBe('Pagos');
    await key(list, 'ArrowRight');
    expect(selected(list).textContent).toBe('Vincular');
    await key(list, 'ArrowLeft');
    expect(selected(list).textContent).toBe('Pagos');
    await key(list, 'Home');
    expect(selected(list).textContent).toBe('Vincular');
    expect(document.activeElement).toBe(selected(list));
  });

  it('the lists of Vincular behave the same', async () => {
    await render(<QuickBooksMapping />);
    const list = tablist('Vincular con QuickBooks');

    expect(tabs(list).filter(t => t.tabIndex === 0)).toHaveLength(1);
    expect(panelOf(list).textContent).toContain('Freeman Sporting Goods');

    selected(list).focus();
    await key(list, 'ArrowRight');
    expect(selected(list).textContent).toContain('Obras');
    expect(document.activeElement).toBe(selected(list));
    expect(panelOf(list).textContent).toContain('55 Twin Lane');
  });

  it('the state filter of Envíos: arrows choose the filter, and the list is its panel', async () => {
    await render(<QuickBooksSync />);
    const list = tablist('Estado');

    expect(tabs(list).filter(t => t.tabIndex === 0)).toHaveLength(1);
    expect(panelOf(list).textContent).toContain('INV-2026-0005');

    selected(list).focus();
    await key(list, 'ArrowRight');
    expect(selected(list).textContent).toBe('Listos');
    expect(document.activeElement).toBe(selected(list));
    expect(panelOf(list)).toBeTruthy();
  });
});

describe('what a screen reader hears', () => {
  it('a failed load is an alert', async () => {
    replies[`GET ${BASE}/sync`] = new ApiError(500, 'Error interno del servidor', undefined, 'INTERNAL_ERROR');
    await render(<QuickBooksSync />);

    expect(document.querySelector('[role="alert"]')?.textContent).toContain('No se pudo cargar el estado');
  });

  it('each counter gives its term before its value', async () => {
    await render(<QuickBooksSync />);

    const pairs = [...document.querySelectorAll('dl > div')].map(d => [...d.children].map(c => c.tagName));
    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs.every(p => p[0] === 'DT' && p[1] === 'DD')).toBe(true);
  });

  it('the company\'s capabilities are said in words, not only by the colour and the mark', async () => {
    await render(<QuickBooksMapping />);

    const items = [...document.querySelectorAll('li')].map(li => li.textContent);
    expect(items).toContain('Proyectos de QuickBooks: no');
    expect(items).toContain('Gastos asignables a una obra: sí');
    expect(items).toContain('Clases: sí');
    expect(items).toContain('Ubicaciones: sin dato');
  });
});

describe('the picker', () => {
  it('shows «Cliente:Obra» whole — the obra is not cut off', async () => {
    replies[`GET ${BASE}/mappings/options`] = [TWIN_LANE];
    await render(<QuickBooksMapping />);

    await click(button('Elegir en QuickBooks'), 'Elegir en QuickBooks');
    await flush(250);

    const option = document.querySelector('[data-testid="quickbooks-picker-options"] button')!;
    expect(option.textContent).toContain('Freeman Sporting Goods:55 Twin Lane');
    expect(option.querySelector('.truncate')).toBeNull();
  });
});
