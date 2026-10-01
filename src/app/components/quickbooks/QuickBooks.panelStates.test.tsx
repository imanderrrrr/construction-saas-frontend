// BuildTrack — the QuickBooks tabs when the server is slow, down or
// unreachable (audit B13, "Pruebas del panel"):
//  - a load that fails, or never reaches the server, leaves a band with
//    «Reintentar» — never a blank card, never the browser's raw words — and
//    retrying recovers;
//  - while a request is on its way, the buttons that would send a second one
//    stay disabled, and come back when it answers.
// «Registrar pago» is covered with M11's fix; not repeated here.
//
// The backend is faked at the HTTP helper, like the tabs' own tests. A reply
// can be a value, an Error (thrown) or a pending promise the test resolves.

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  QuickBooksMappingOverview, QuickBooksPaymentsStatus, QuickBooksStatus, QuickBooksSyncOverview, QuickBooksSyncRow,
} from '../../services/quickbooks';

vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  api: (path: string, init?: RequestInit) => fakeApi(path, init),
}));
vi.mock('../../services/quickbooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/quickbooks')>()),
  // jsdom cannot leave for Intuit's consent page.
  openIntuitConsent: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { QuickBooksSection } from './QuickBooksSection';
import { QuickBooksMapping } from './QuickBooksMapping';
import { QuickBooksSync } from './QuickBooksSync';
import { QuickBooksPayments } from './QuickBooksPayments';
import { ApiError } from '../../lib/api';
import i18n from '../../../i18n';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const BASE = '/api/v1/admin/integrations/quickbooks';

const NOT_CONNECTED: QuickBooksStatus = {
  configured: true, environment: 'SANDBOX', state: 'NOT_CONNECTED', companyName: null, realmId: null,
  connectedAt: null, connectedBy: null, lastRefreshedAt: null, refreshTokenExpiresAt: null,
  refreshTokenHardExpiresAt: null, lastError: null,
};

const ACTIVE: QuickBooksStatus = {
  ...NOT_CONNECTED, state: 'ACTIVE', companyName: 'Constructora Peña S.A.', realmId: '9130000009',
  connectedAt: '2026-09-25T15:00:00Z', connectedBy: 'admin', lastRefreshedAt: '2026-09-25T15:00:00Z',
  refreshTokenExpiresAt: '2027-01-03T15:00:00Z', refreshTokenHardExpiresAt: '2031-09-24T15:00:00Z',
};

const MAPPINGS: QuickBooksMappingOverview = {
  company: {
    connected: true, realmId: '9130000009', companyName: 'Constructora Peña S.A.', plan: 'PLUS', offeringSku: 'QuickBooks Online Plus',
    country: 'US', homeCurrency: 'USD', projectsEnabled: false, classTracking: false, locationTracking: false, expensesByCustomer: true,
    jobTracking: 'SUB_CUSTOMERS', profileReadAt: '2026-09-25T16:00:00Z', directoryRefreshedAt: '2026-09-25T16:00:00Z',
    directoryCounts: { CUSTOMER: 29 },
  },
  clients: [{
    type: 'CLIENT', localKey: '1', localLabel: 'Freeman Sporting Goods', detail: null, link: null, billCount: null, billTotalCents: null,
    suggestion: { qboId: '7', name: 'Freeman Sporting Goods', fullName: null, kind: 'CUSTOMER', isProject: false, isSubCustomer: false, accountType: null, active: true },
  }],
  projects: [], vendors: [], categories: [], invoiceItem: [],
};

const readyRow = (docId: number): QuickBooksSyncRow => ({
  type: 'INVOICE', docId, documentType: 'INVOICE', number: `INV-2026-000${docId}`, vendorInvoiceNumber: null,
  party: 'Cliente Demo', projectName: 'Torre Norte', date: '2026-09-25', amountCents: 300_00, state: 'READY',
  reasons: [], linkTabs: [], errorMessage: null, warning: null, deletedHere: false, qboId: null, qboDocNumber: null, qboUrl: null,
  sentAt: null, sentBy: null, syncedAt: null, lastAttemptAt: null, nextAttemptAt: null, skippedBy: null,
  attachmentsTotal: null, attachmentsSent: null,
});

const SYNC: QuickBooksSyncOverview = {
  settings: {
    connected: true, environment: 'SANDBOX', realmId: '9130000009', companyName: 'Constructora Peña S.A.',
    cutoverDate: '2026-09-20', autoSend: false, autoSendChangedBy: null, autoSendChangedAt: null, autoSendIntervalMinutes: 2,
    lastRunAt: null, lastRunSummary: null, plan: 'PLUS', expensesByCustomer: true, customTxnNumbers: false, allowDiscount: true,
    usingSalesTax: true, preferencesRead: true,
  },
  summary: { ready: 2, blocked: 0, failed: 0, sent: 0, changed: 0, skipped: 0, closed: 0 },
  rows: [readyRow(5), readyRow(6)],
  page: 0, size: 25, totalElements: 2, totalPages: 1,
};

const PAYMENTS: QuickBooksPaymentsStatus = {
  connected: true, enabled: true, changedBy: 'admin', changedAt: '2026-09-25T20:00:00Z', intervalMinutes: 60,
  readAt: '2026-09-25T20:05:00Z', cursor: '2026-09-25T20:05:00Z', lastError: null, running: false,
  webhook: { configured: false, url: null, lastEventAt: null, pendingEvents: 0 },
  localPaymentsDocuments: 0, localPaymentsCents: 0, recent: [],
};

let replies: Record<string, unknown> = {};

async function fakeApi(path: string, init?: RequestInit): Promise<unknown> {
  const key = `${(init?.method ?? 'GET').toUpperCase()} ${path.split('?')[0]}`;
  if (!(key in replies)) throw new Error(`unscripted ${key}`);
  const reply = replies[key];
  if (reply instanceof Error) throw reply;
  return reply; // a value, or a promise the test resolves later
}

/** A reply the test answers when it chooses. */
function pending<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

let host: HTMLDivElement;
let root: Root;

async function flush() {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
}

async function render(node: ReactElement) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(node); });
  await flush();
}

const text = () => document.body.textContent ?? '';

function button(label: string, scope: ParentNode = document): HTMLButtonElement | undefined {
  return [...scope.querySelectorAll('button')].find(b => b.textContent?.trim().startsWith(label)) as HTMLButtonElement | undefined;
}

async function click(el: HTMLElement | undefined, what: string) {
  expect(el, what).toBeTruthy();
  await act(async () => { el!.click(); });
  await flush();
}

beforeEach(async () => {
  await i18n.changeLanguage('es');
  replies = {};
});

afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  document.body.innerHTML = '';
});

// ── Loads that fail ───────────────────────────────────────────────────────

const TABS: Array<{ name: string; node: () => ReactElement; load: string; ok: unknown; shows: string }> = [
  // Not connected: an ACTIVE card would also mount (and load) the Vincular tab.
  { name: 'the connection card', node: () => <QuickBooksSection />, load: `GET ${BASE}`, ok: NOT_CONNECTED, shows: 'Tu QuickBooks todavía no está conectado' },
  { name: 'Vincular', node: () => <QuickBooksMapping />, load: `GET ${BASE}/mappings`, ok: MAPPINGS, shows: 'Freeman Sporting Goods' },
  { name: 'Envíos', node: () => <QuickBooksSync />, load: `GET ${BASE}/sync`, ok: SYNC, shows: 'INV-2026-0005' },
  { name: 'Pagos', node: () => <QuickBooksPayments />, load: `GET ${BASE}/payments`, ok: PAYMENTS, shows: 'Pagos desde QuickBooks' },
];

describe('a load that fails', () => {
  it.each(TABS)('$name: a server error leaves a band with «Reintentar», and retrying recovers', async ({ node, load, ok, shows }) => {
    replies[load] = new ApiError(500, 'Internal error', undefined, 'INTERNAL_ERROR');
    await render(node());

    expect(text()).toContain('No se pudo cargar el estado');
    expect(text()).not.toContain(shows);

    replies[load] = ok;
    await click(button('Reintentar'), 'Reintentar');

    expect(text()).not.toContain('No se pudo cargar el estado');
    expect(text()).toContain(shows);
  });

  it.each(TABS)('$name: with the network down it says so in the panel\'s words, not the browser\'s', async ({ node, load, ok, shows }) => {
    replies[load] = new TypeError('Failed to fetch');
    await render(node());

    expect(text()).toContain('No se pudo cargar el estado');
    expect(text()).not.toContain('Failed to fetch');

    replies[load] = ok;
    await click(button('Reintentar'), 'Reintentar');
    expect(text()).toContain(shows);
  });
});

// ── Requests on their way ─────────────────────────────────────────────────

describe('while a request is on its way', () => {
  it('the connection card: «Probar conexión» and «Desconectar» wait for the answer', async () => {
    replies[`GET ${BASE}`] = ACTIVE;
    replies[`GET ${BASE}/mappings`] = MAPPINGS;
    const test = pending<QuickBooksStatus>();
    replies[`POST ${BASE}/test`] = test.promise;
    await render(<QuickBooksSection />);

    await click(button('Probar conexión'), 'Probar conexión');
    expect(button('Probar conexión')!.disabled).toBe(true);
    expect(button('Desconectar')!.disabled).toBe(true);

    await act(async () => { test.resolve(ACTIVE); });
    await flush();
    expect(button('Probar conexión')!.disabled).toBe(false);
    expect(button('Desconectar')!.disabled).toBe(false);
  });

  it('the connection card: «Conectar» cannot mint a second consent link while the first is on its way', async () => {
    replies[`GET ${BASE}`] = NOT_CONNECTED;
    const connect = pending<{ authorizationUrl: string }>();
    replies[`POST ${BASE}/connect`] = connect.promise;
    await render(<QuickBooksSection />);

    await click(button('Conectar con QuickBooks'), 'Conectar con QuickBooks');
    expect(button('Abriendo Intuit…')?.disabled).toBe(true);

    // And it stays so while the browser leaves for Intuit.
    await act(async () => { connect.resolve({ authorizationUrl: 'about:blank' }); });
    await flush();
    expect(button('Abriendo Intuit…')?.disabled).toBe(true);
  });

  it('Vincular: every button waits while the company is read from QuickBooks', async () => {
    replies[`GET ${BASE}/mappings`] = MAPPINGS;
    const refresh = pending<unknown>();
    replies[`POST ${BASE}/company/refresh`] = refresh.promise;
    await render(<QuickBooksMapping />);

    await click(button('Actualizar desde QuickBooks'), 'Actualizar desde QuickBooks');
    expect(button('Actualizando…')?.disabled).toBe(true);
    expect(button('Aceptar')!.disabled).toBe(true);
    expect(button('Elegir en QuickBooks')!.disabled).toBe(true);

    await act(async () => { refresh.resolve(MAPPINGS.company); });
    await flush();
    expect(button('Actualizar desde QuickBooks')!.disabled).toBe(false);
    expect(button('Aceptar')!.disabled).toBe(false);
  });

  it('Envíos: while one document is sent, no other send (nor «Enviar todos») can start', async () => {
    replies[`GET ${BASE}/sync`] = SYNC;
    const send = pending<unknown>();
    replies[`POST ${BASE}/sync/INVOICE/5/send`] = send.promise;
    await render(<QuickBooksSync />);

    const rowOf = (n: string) => [...document.querySelectorAll('li')].find(li => li.textContent?.includes(n)) as HTMLElement;
    const sendIn = (n: string) => [...rowOf(n).querySelectorAll('button')].find(b => b.textContent?.trim() === 'Enviar') as HTMLButtonElement | undefined;
    await click(sendIn('INV-2026-0005'), 'Enviar');

    expect(sendIn('INV-2026-0006')!.disabled).toBe(true);
    expect(button('Enviar todos los listos')!.disabled).toBe(true);
    expect(rowOf('INV-2026-0005').textContent).toContain('Enviando…');

    await act(async () => { send.resolve({ ...SYNC.rows[0], state: 'SENT', qboId: '145' }); });
    await flush();
    expect(sendIn('INV-2026-0006')!.disabled).toBe(false);
    expect(button('Enviar todos los listos')!.disabled).toBe(false);
  });

  it('Pagos: «Actualizar pagos» and the switch wait for the read', async () => {
    replies[`GET ${BASE}/payments`] = PAYMENTS;
    const read = pending<unknown>();
    replies[`POST ${BASE}/payments/refresh`] = read.promise;
    await render(<QuickBooksPayments />);

    await click(button('Actualizar pagos'), 'Actualizar pagos');
    expect(button('Leyendo…')?.disabled).toBe(true);
    expect((document.querySelector('[role=switch]') as HTMLButtonElement).disabled).toBe(true);

    await act(async () => {
      read.resolve({
        result: { mode: 'CDC', reads: 1, paymentsRead: 0, documentsChecked: 0, documentsUpdated: 0, failed: 0, stoppedBy: null },
        status: PAYMENTS,
      });
    });
    await flush();
    expect(button('Actualizar pagos')!.disabled).toBe(false);
    expect((document.querySelector('[role=switch]') as HTMLButtonElement).disabled).toBe(false);
  });
});
