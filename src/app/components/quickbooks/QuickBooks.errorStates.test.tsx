// BuildTrack — the QuickBooks section when something goes wrong (audit B16):
//  - a failed load says what failed: the admin's internet only when no answer
//    came back, not for a 403, a 500 or a 503;
//  - a failed action never shows the browser's own words («Failed to fetch»);
//  - a failed disconnect is said inside its window, not behind it;
//  - a send or a payments read stopped by the link itself reaches the card,
//    which no longer just reads «Conectado»;
//  - a row in a state this panel does not know yet does not take the tab down.
//
// The backend is faked at the HTTP helper, like the tabs' own tests.

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

import { toast } from 'sonner';
import { QuickBooksSection } from './QuickBooksSection';
import { QuickBooksMapping } from './QuickBooksMapping';
import { QuickBooksSync } from './QuickBooksSync';
import { QuickBooksPayments } from './QuickBooksPayments';
import { connectionStop, describeError, loadFailureKey } from './errors';
import { ApiError } from '../../lib/api';
import i18n from '../../../i18n';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const BASE = '/api/v1/admin/integrations/quickbooks';
const NO_ANSWER = 'No hubo respuesta del servidor. Revisa la conexión a internet e intenta de nuevo.';

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
    suggestion: null,
  }],
  projects: [], vendors: [], categories: [], invoiceItem: [],
};

function syncRow(docId: number, state: string): QuickBooksSyncRow {
  return {
    type: 'INVOICE', docId, documentType: 'INVOICE', number: `INV-2026-000${docId}`, vendorInvoiceNumber: null,
    party: 'Cliente Demo', projectName: 'Torre Norte', date: '2026-09-25', amountCents: 300_00,
    state: state as QuickBooksSyncRow['state'],
    reasons: [], linkTabs: [], errorMessage: null, warning: null, deletedHere: false, qboId: null, qboDocNumber: null, qboUrl: null,
    sentAt: null, sentBy: null, syncedAt: null, lastAttemptAt: null, nextAttemptAt: null, skippedBy: null,
    attachmentsTotal: null, attachmentsSent: null,
  };
}

function syncOverview(rows: QuickBooksSyncRow[]): QuickBooksSyncOverview {
  return {
    settings: {
      connected: true, environment: 'SANDBOX', realmId: '9130000009', companyName: 'Constructora Peña S.A.',
      cutoverDate: '2026-09-20', autoSend: false, autoSendChangedBy: null, autoSendChangedAt: null, autoSendIntervalMinutes: 2,
      lastRunAt: null, lastRunSummary: null, plan: 'PLUS', expensesByCustomer: true, customTxnNumbers: false, allowDiscount: true,
      usingSalesTax: true, preferencesRead: true,
    },
    summary: { ready: rows.filter(r => r.state === 'READY').length, blocked: 0, failed: 0, sent: 0, changed: 0, skipped: 0, closed: 0 },
    rows, page: 0, size: 25, totalElements: rows.length, totalPages: 1,
  };
}

const PAYMENTS: QuickBooksPaymentsStatus = {
  connected: true, enabled: true, changedBy: 'admin', changedAt: '2026-09-25T20:00:00Z', intervalMinutes: 60,
  readAt: '2026-09-25T20:05:00Z', cursor: '2026-09-25T20:05:00Z', lastError: null, running: false,
  webhook: { configured: false, url: null, lastEventAt: null, pendingEvents: 0 },
  localPaymentsDocuments: 0, localPaymentsCents: 0, recent: [],
};

const RUN = {
  processed: 1, created: 0, updated: 0, voided: 0, deleted: 0, failed: 1, blocked: 0,
  attachmentsSent: 0, attachmentsFailed: 0, remaining: 0,
};

let replies: Record<string, unknown> = {};
const calls: string[] = [];

async function fakeApi(path: string, init?: RequestInit): Promise<unknown> {
  const key = `${(init?.method ?? 'GET').toUpperCase()} ${path.split('?')[0]}`;
  calls.push(key);
  if (!(key in replies)) throw new Error(`unscripted ${key}`);
  const reply = replies[key];
  if (reply instanceof Error) throw reply;
  return typeof reply === 'function' ? reply() : reply;
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

const dialog = () => document.querySelector('[role="dialog"]') as HTMLElement | null;
const statusReads = () => calls.filter(c => c === `GET ${BASE}`).length;

async function openTab(label: string) {
  const tab = [...document.querySelectorAll('[role="tab"]')].find(b => b.textContent?.trim() === label) as HTMLElement;
  await click(tab, label);
}

beforeEach(async () => {
  await i18n.changeLanguage('es');
  replies = {};
  calls.length = 0;
  vi.mocked(toast.error).mockClear();
});

afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  document.body.innerHTML = '';
});

describe('loadFailureKey, describeError and connectionStop', () => {
  it('blame the internet only when no answer came back, and never pass the browser\'s words on', () => {
    expect(loadFailureKey(new TypeError('Failed to fetch'))).toBe('load.errorBody');
    expect(loadFailureKey(new ApiError(403, 'Forbidden'))).toBe('load.errorForbidden');
    expect(loadFailureKey(new ApiError(401, 'Unauthorized'))).toBe('load.errorForbidden');
    expect(loadFailureKey(new ApiError(500, 'Error interno del servidor', undefined, 'INTERNAL_ERROR'))).toBe('load.errorServer');
    expect(loadFailureKey(new ApiError(503, 'La solicitud falló (503)'))).toBe('load.errorServer');

    expect(describeError(new ApiError(409, 'Ya hay un envío en curso.', undefined, 'QUICKBOOKS_SYNC_RUNNING'))).toBe('Ya hay un envío en curso.');
    expect(describeError(new TypeError('Failed to fetch'))).toBe(NO_ANSWER);
  });

  it('connectionStop picks out the codes of the link itself', () => {
    expect(connectionStop('QUICKBOOKS_AUTH_REJECTED')).toBe('QUICKBOOKS_AUTH_REJECTED');
    expect(connectionStop(new ApiError(409, 'x', undefined, 'QUICKBOOKS_NEEDS_RECONNECT'))).toBe('QUICKBOOKS_NEEDS_RECONNECT');
    expect(connectionStop('QUICKBOOKS_RATE_LIMITED')).toBeNull();
    expect(connectionStop(null)).toBeNull();
    expect(connectionStop(new TypeError('QUICKBOOKS_AUTH_REJECTED'))).toBeNull();
  });
});

const TABS: Array<{ name: string; node: () => ReactElement; load: string }> = [
  { name: 'the connection card', node: () => <QuickBooksSection />, load: `GET ${BASE}` },
  { name: 'Vincular', node: () => <QuickBooksMapping />, load: `GET ${BASE}/mappings` },
  { name: 'Envíos', node: () => <QuickBooksSync />, load: `GET ${BASE}/sync` },
  { name: 'Pagos', node: () => <QuickBooksPayments />, load: `GET ${BASE}/payments` },
];

describe('a load that fails says what failed', () => {
  it.each(TABS)('$name: a 500 or a 503 is the server, not the admin\'s internet', async ({ node, load }) => {
    replies[load] = new ApiError(503, 'La solicitud falló (503)');
    await render(node());

    expect(text()).toContain('No se pudo cargar el estado');
    expect(text()).toContain('El servidor no pudo cargar esta sección. Intenta de nuevo en unos minutos.');
    expect(text()).not.toContain('Revisa la conexión a internet');
  });

  it.each(TABS)('$name: a 403 is a permission', async ({ node, load }) => {
    replies[load] = new ApiError(403, 'Acceso denegado');
    await render(node());

    expect(text()).toContain('Tu usuario no tiene permiso para ver esta sección.');
    expect(text()).not.toContain('Revisa la conexión a internet');
  });

  it.each(TABS)('$name: no answer at all is the internet', async ({ node, load }) => {
    replies[load] = new TypeError('Failed to fetch');
    await render(node());

    expect(text()).toContain('Revisa la conexión a internet e intenta de nuevo.');
    expect(text()).not.toContain('Failed to fetch');
  });
});

describe('a failed action never shows the browser\'s words', () => {
  it('Conectar, with the network down', async () => {
    replies[`GET ${BASE}`] = NOT_CONNECTED;
    replies[`POST ${BASE}/connect`] = new TypeError('Failed to fetch');
    await render(<QuickBooksSection />);

    await click(button('Conectar con QuickBooks'), 'Conectar con QuickBooks');

    expect(text()).toContain(NO_ANSWER);
    expect(text()).not.toContain('Failed to fetch');
  });

  it('a send, a refresh of the company and a payments read, with the network down', async () => {
    replies[`GET ${BASE}/sync`] = syncOverview([syncRow(5, 'READY')]);
    replies[`POST ${BASE}/sync/INVOICE/5/send`] = new TypeError('Failed to fetch');
    await render(<QuickBooksSync />);
    await click(button('Enviar', document.querySelector('li')!), 'Enviar');
    expect(toast.error).toHaveBeenLastCalledWith('No se pudo completar.', { description: NO_ANSWER });
    await act(async () => root.unmount());

    replies[`GET ${BASE}/mappings`] = MAPPINGS;
    replies[`POST ${BASE}/company/refresh`] = new TypeError('Failed to fetch');
    await render(<QuickBooksMapping />);
    await click(button('Actualizar desde QuickBooks'), 'Actualizar desde QuickBooks');
    expect(toast.error).toHaveBeenLastCalledWith('No se pudo completar.', { description: NO_ANSWER });
    await act(async () => root.unmount());

    replies[`GET ${BASE}/payments`] = PAYMENTS;
    replies[`POST ${BASE}/payments/refresh`] = new TypeError('Failed to fetch');
    await render(<QuickBooksPayments />);
    await click(button('Actualizar pagos'), 'Actualizar pagos');
    expect(toast.error).toHaveBeenLastCalledWith('No se pudo completar.', { description: NO_ANSWER });
  });
});

describe('a disconnect that fails', () => {
  it('says so inside the window, where the admin is looking — not behind it', async () => {
    replies[`GET ${BASE}`] = ACTIVE;
    replies[`GET ${BASE}/mappings`] = MAPPINGS;
    replies[`POST ${BASE}/disconnect`] = new ApiError(500, 'Error interno del servidor', undefined, 'INTERNAL_ERROR');
    await render(<QuickBooksSection />);

    await click(button('Desconectar'), 'Desconectar');
    await click(button('Sí, desconectar', dialog()!), 'Sí, desconectar');

    expect(dialog()?.textContent).toContain('No se pudo desconectar');
    expect(dialog()?.textContent).toContain('Error interno del servidor');
    // Not twice: the page's own band waits for the window to close.
    expect(host.textContent).not.toContain('Error interno del servidor');

    await click(button('Cancelar', dialog()!), 'Cancelar');
    expect(host.textContent).toContain('Error interno del servidor');

    // Opening it again starts clean.
    await click(button('Desconectar'), 'Desconectar');
    expect(dialog()?.textContent).not.toContain('No se pudo desconectar');
  });
});

describe('a send or a read stopped by the link itself', () => {
  it('«Enviar todos» stopped by a rejected permission: the card re-reads the link and says so, until a test comes out fine', async () => {
    replies[`GET ${BASE}`] = ACTIVE;
    replies[`GET ${BASE}/mappings`] = MAPPINGS;
    replies[`GET ${BASE}/sync`] = syncOverview([syncRow(5, 'READY')]);
    replies[`POST ${BASE}/sync/send-ready`] = { ...RUN, stoppedBy: 'QUICKBOOKS_AUTH_REJECTED' };
    await render(<QuickBooksSection />);
    await openTab('Envíos');
    const before = statusReads();

    await click(button('Enviar todos los listos'), 'Enviar todos los listos');

    expect(statusReads()).toBe(before + 1);
    expect(text()).toContain('Envíos o pagos detenidos');
    expect(text()).toContain('QuickBooks rechazó el permiso de tu conexión en el último envío o lectura de pagos.');

    replies[`POST ${BASE}/test`] = ACTIVE;
    await click(button('Probar conexión'), 'Probar conexión');
    expect(text()).not.toContain('Envíos o pagos detenidos');
  });

  it('a send refused because the link needs a reconnect: the card turns into «La conexión dejó de funcionar»', async () => {
    let status: QuickBooksStatus = ACTIVE;
    replies[`GET ${BASE}`] = () => status;
    replies[`GET ${BASE}/mappings`] = MAPPINGS;
    replies[`GET ${BASE}/sync`] = syncOverview([syncRow(5, 'READY')]);
    replies[`POST ${BASE}/sync/INVOICE/5/send`] = new ApiError(409, 'Hay que volver a conectar QuickBooks.', undefined, 'QUICKBOOKS_NEEDS_RECONNECT');
    await render(<QuickBooksSection />);
    await openTab('Envíos');

    status = { ...ACTIVE, state: 'NEEDS_RECONNECT', lastError: 'REFRESH_REJECTED' };
    await click(button('Enviar', document.querySelector('li')!), 'Enviar');

    expect(text()).toContain('La conexión dejó de funcionar');
    expect(button('Volver a conectar')).toBeTruthy();
  });

  it('a single send that comes back failed on a rejected permission reaches the card', async () => {
    replies[`GET ${BASE}`] = ACTIVE;
    replies[`GET ${BASE}/mappings`] = MAPPINGS;
    replies[`GET ${BASE}/sync`] = syncOverview([syncRow(5, 'READY')]);
    // No error: the server answers with the row, failed, and says why.
    replies[`POST ${BASE}/sync/INVOICE/5/send`] = { ...syncRow(5, 'FAILED'), reasons: ['QUICKBOOKS_AUTH_REJECTED'] };
    await render(<QuickBooksSection />);
    await openTab('Envíos');

    await click(button('Enviar', document.querySelector('li')!), 'Enviar');

    expect(text()).toContain('Envíos o pagos detenidos');
  });

  it('a payments read stopped by a rejected permission reaches the card too', async () => {
    replies[`GET ${BASE}`] = ACTIVE;
    replies[`GET ${BASE}/mappings`] = MAPPINGS;
    replies[`GET ${BASE}/payments`] = PAYMENTS;
    replies[`POST ${BASE}/payments/refresh`] = {
      result: { mode: 'CDC', reads: 1, paymentsRead: 0, documentsChecked: 0, documentsUpdated: 0, failed: 0, stoppedBy: 'QUICKBOOKS_AUTH_REJECTED' },
      status: PAYMENTS,
    };
    await render(<QuickBooksSection />);
    await openTab('Pagos');

    await click(button('Actualizar pagos'), 'Actualizar pagos');

    expect(text()).toContain('Envíos o pagos detenidos');
  });

  it('switching payments on, whose first read stops on the link, reaches the card', async () => {
    replies[`GET ${BASE}`] = ACTIVE;
    replies[`GET ${BASE}/mappings`] = MAPPINGS;
    replies[`GET ${BASE}/payments`] = { ...PAYMENTS, enabled: false };
    replies[`PUT ${BASE}/payments/settings`] = { ...PAYMENTS, lastError: 'QUICKBOOKS_AUTH_REJECTED' };
    await render(<QuickBooksSection />);
    await openTab('Pagos');

    await click(document.querySelector('[role=switch]') as HTMLElement, 'the switch');
    await click(button('Encender', dialog()!), 'Encender');

    expect(text()).toContain('Envíos o pagos detenidos');
  });

  it('a stop that is not the link\'s (the monthly meter) leaves the card alone', async () => {
    replies[`GET ${BASE}`] = ACTIVE;
    replies[`GET ${BASE}/mappings`] = MAPPINGS;
    replies[`GET ${BASE}/sync`] = syncOverview([syncRow(5, 'READY')]);
    replies[`POST ${BASE}/sync/send-ready`] = { ...RUN, failed: 0, remaining: 1, stoppedBy: 'QUICKBOOKS_RATE_LIMITED' };
    await render(<QuickBooksSection />);
    await openTab('Envíos');
    const before = statusReads();

    await click(button('Enviar todos los listos'), 'Enviar todos los listos');

    expect(statusReads()).toBe(before);
    expect(text()).not.toContain('Envíos o pagos detenidos');
  });
});

describe('a row in a state the panel does not know yet', () => {
  it('shows the row as another state and offers nothing on it, without taking the tab down', async () => {
    replies[`GET ${BASE}/sync`] = syncOverview([syncRow(5, 'READY'), syncRow(6, 'ARCHIVED')]);
    await render(<QuickBooksSync />);

    const rows = [...document.querySelectorAll('li')];
    const unknown = rows.find(li => li.textContent?.includes('INV-2026-0006'))!;
    expect(unknown.textContent).toContain('Otro estado (ARCHIVED)');
    expect(unknown.querySelectorAll('button')).toHaveLength(0);
    expect(button('Enviar', rows.find(li => li.textContent?.includes('INV-2026-0005'))!)).toBeTruthy();
    expect(text()).toContain('Envío a QuickBooks');
  });
});
