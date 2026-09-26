// BuildTrack — the "Envíos" section: it says in words where every invoice
// and bill stands against QuickBooks, its buttons reach the right endpoints
// with the right document, and the automatic sender is never switched on by
// accident.
//
// The backend is faked at the HTTP helper, like QuickBooksMapping's tests.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuickBooksSyncOverview, QuickBooksSyncRow, QuickBooksSyncSettings } from '../../services/quickbooks';

vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  api: (path: string, init?: RequestInit) => fakeApi(path, init),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { QuickBooksSync } from './QuickBooksSync';
import { toast } from 'sonner';
import i18n from '../../../i18n';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const BASE = '/api/v1/admin/integrations/quickbooks/sync';

const SETTINGS: QuickBooksSyncSettings = {
  connected: true,
  environment: 'SANDBOX',
  realmId: '9130000009',
  companyName: 'Constructora Peña S.A.',
  cutoverDate: '2026-09-20',
  autoSend: false,
  autoSendChangedBy: null,
  autoSendChangedAt: null,
  autoSendIntervalMinutes: 2,
  lastRunAt: null,
  lastRunSummary: null,
  plan: 'PLUS',
  expensesByCustomer: true,
  customTxnNumbers: false,
  allowDiscount: true,
  usingSalesTax: true,
  preferencesRead: true,
};

function row(partial: Partial<QuickBooksSyncRow> & Pick<QuickBooksSyncRow, 'type' | 'docId' | 'number' | 'state'>): QuickBooksSyncRow {
  return {
    documentType: partial.type === 'BILL' ? 'BILL' : 'INVOICE',
    vendorInvoiceNumber: null,
    party: 'Cliente Demo',
    projectName: 'Torre Norte',
    date: '2026-09-25',
    amountCents: 300_00,
    reasons: [],
    linkTabs: [],
    errorMessage: null,
    warning: null,
    deletedHere: false,
    qboId: null,
    qboDocNumber: null,
    qboUrl: null,
    sentAt: null,
    sentBy: null,
    syncedAt: null,
    lastAttemptAt: null,
    nextAttemptAt: null,
    skippedBy: null,
    attachmentsTotal: null,
    attachmentsSent: null,
    ...partial,
  };
}

const READY = row({ type: 'INVOICE', docId: 5, number: 'INV-2026-0005', state: 'READY' });
const TAXED = row({ type: 'INVOICE', docId: 6, number: 'INV-2026-0006', state: 'BLOCKED', reasons: ['HAS_SALES_TAX'] });
const NO_VENDOR = row({
  type: 'BILL', docId: 9, number: 'BILL-2026-0009', state: 'BLOCKED', party: 'Rentadora XYZ',
  reasons: ['VENDOR_NOT_LINKED'], linkTabs: ['vendors'],
});
const SIMPLE_START = row({
  type: 'BILL', docId: 10, number: 'BILL-2026-0010', state: 'BLOCKED', party: 'Ferretería Central',
  reasons: ['PLAN_NO_BILLS'], errorMessage: 'Feature Not Supported Error',
});
const SENT = row({
  type: 'INVOICE', docId: 7, number: 'INV-2026-0007', state: 'SENT', qboId: '145', qboDocNumber: '1038',
  qboUrl: 'https://app.sandbox.qbo.intuit.com/app/invoice?txnId=145', sentAt: '2026-09-25T20:00:00Z', sentBy: 'system',
});
const DELETED_HERE = row({
  type: 'BILL', docId: 11, number: 'BILL-2026-0011', state: 'CHANGED', deletedHere: true, qboId: '150',
  qboUrl: 'https://app.sandbox.qbo.intuit.com/app/bill?txnId=150',
});

function overview(rows: QuickBooksSyncRow[] = [READY, TAXED, NO_VENDOR, SIMPLE_START, SENT, DELETED_HERE], settings = SETTINGS): QuickBooksSyncOverview {
  return {
    settings,
    summary: { ready: 1, blocked: 3, failed: 0, sent: 1, changed: 1, skipped: 0, closed: 0 },
    rows,
    page: 0,
    size: 25,
    totalElements: rows.length,
    totalPages: 1,
  };
}

let current: QuickBooksSyncOverview = overview();
let replies: Record<string, unknown> = {};
const calls: Array<{ key: string; body: unknown }> = [];

async function fakeApi(path: string, init?: RequestInit): Promise<unknown> {
  const method = (init?.method ?? 'GET').toUpperCase();
  calls.push({ key: `${method} ${path}`, body: init?.body ? JSON.parse(String(init.body)) : undefined });
  const key = `${method} ${path.split('?')[0]}`;
  if (key in replies) {
    const reply = replies[key];
    if (reply instanceof Error) throw reply;
    return reply;
  }
  if (key === `GET ${BASE}`) return current;
  throw new Error(`unscripted ${key}`);
}

let host: HTMLDivElement;
let root: Root;
const openMapping = vi.fn();

async function flush() {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
}

async function render() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(<QuickBooksSync onOpenMapping={openMapping} />); });
  await flush();
}

const text = () => document.body.textContent ?? '';

function buttons(label: string): HTMLButtonElement[] {
  return [...document.querySelectorAll('button')].filter(b => b.textContent?.trim().startsWith(label)) as HTMLButtonElement[];
}

/** The row of one document (its <li>), to click a button that several rows share. */
function rowOf(number: string): HTMLElement {
  const item = [...document.querySelectorAll('li')].find(li => li.textContent?.includes(number));
  expect(item, number).toBeTruthy();
  return item as HTMLElement;
}

function buttonIn(scope: HTMLElement, label: string): HTMLButtonElement | undefined {
  return [...scope.querySelectorAll('button')].find(b => b.textContent?.trim().startsWith(label)) as HTMLButtonElement | undefined;
}

async function click(el: HTMLElement | undefined) {
  expect(el).toBeTruthy();
  await act(async () => { el!.click(); });
  await flush();
}

beforeEach(async () => {
  await i18n.changeLanguage('es');
  current = overview();
  replies = {};
  calls.length = 0;
  openMapping.mockClear();
  vi.mocked(toast.success).mockClear();
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  document.body.innerHTML = '';
});

describe('QuickBooksSync', () => {
  it('counts the documents and says in words why each one is held back', async () => {
    await render();

    expect(text()).toContain('Listos');
    expect(text()).toContain('Bloqueados');
    expect(text()).toContain('INV-2026-0005');
    expect(text()).toContain('Tiene impuesto de venta: pendiente confirmar con el contador');
    expect(text()).toContain('El proveedor no está vinculado con QuickBooks.');
    expect(text()).toContain('no incluye cuentas por pagar (Simple Start)');
    expect(text()).toContain('QuickBooks dijo: Feature Not Supported Error');
    expect(text()).toContain('Se borró en BuildTrack: se borrará en QuickBooks.');
    expect(text()).toContain('No. en QuickBooks: 1038');
    expect(text()).toContain('Enviado por el envío automático');
    expect(text()).not.toContain('HAS_SALES_TAX');
    expect(document.querySelectorAll('[data-testid="quickbooks-sync-row"]').length).toBe(6);
  });

  it('a missing link sends the admin to the Vincular tab that fixes it', async () => {
    await render();

    await click(buttonIn(rowOf('BILL-2026-0009'), 'Vincular proveedor'));

    expect(openMapping).toHaveBeenCalledWith('vendors');
    // Blocked on our side: nothing to retry until the link exists.
    expect(buttonIn(rowOf('BILL-2026-0009'), 'Reintentar')).toBeUndefined();
    expect(buttonIn(rowOf('INV-2026-0006'), 'Reintentar')).toBeUndefined();
    // Refused by QuickBooks: a person can retry.
    expect(buttonIn(rowOf('BILL-2026-0010'), 'Reintentar')).toBeTruthy();
  });

  it('sends one document to its own endpoint and re-reads the list', async () => {
    replies[`POST ${BASE}/INVOICE/5/send`] = { ...READY, state: 'SENT', qboId: '146' };
    await render();
    const readsBefore = calls.filter(c => c.key.startsWith(`GET ${BASE}`)).length;

    await click(buttonIn(rowOf('INV-2026-0005'), 'Enviar'));

    expect(calls.map(c => c.key)).toContain(`POST ${BASE}/INVOICE/5/send`);
    expect(calls.filter(c => c.key.startsWith(`GET ${BASE}`)).length).toBe(readsBefore + 1);
    expect(toast.success).toHaveBeenCalledWith('INV-2026-0005 quedó en QuickBooks.');
  });

  it('a document deleted here offers to delete it in QuickBooks, and links to it there', async () => {
    replies[`POST ${BASE}/BILL/11/send`] = { ...DELETED_HERE, state: 'DELETED' };
    await render();
    const item = rowOf('BILL-2026-0011');

    const link = [...item.querySelectorAll('a')].find(a => a.textContent?.includes('Ver en QuickBooks')) as HTMLAnchorElement;
    expect(link.href).toBe('https://app.sandbox.qbo.intuit.com/app/bill?txnId=150');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');

    await click(buttonIn(item, 'Borrar en QuickBooks'));
    expect(calls.map(c => c.key)).toContain(`POST ${BASE}/BILL/11/send`);
  });

  it('marks a document "No enviar" and reactivates it', async () => {
    replies[`POST ${BASE}/INVOICE/5/skip`] = { ...READY, state: 'SKIPPED' };
    await render();

    await click(buttonIn(rowOf('INV-2026-0005'), 'No enviar'));
    expect(calls.map(c => c.key)).toContain(`POST ${BASE}/INVOICE/5/skip`);

    current = overview([{ ...READY, state: 'SKIPPED', skippedBy: 'admin' }]);
    replies[`POST ${BASE}/INVOICE/5/unskip`] = READY;
    await act(async () => root.unmount());
    await render();
    expect(text()).toContain('Marcado «No enviar» por admin.');

    await click(buttonIn(rowOf('INV-2026-0005'), 'Reactivar'));
    expect(calls.map(c => c.key)).toContain(`POST ${BASE}/INVOICE/5/unskip`);
  });

  it('sends everything pending at once and says what is left', async () => {
    replies[`POST ${BASE}/send-ready`] = {
      processed: 2, created: 1, updated: 0, voided: 0, deleted: 1, failed: 0, blocked: 0,
      attachmentsSent: 0, attachmentsFailed: 0, remaining: 3, stoppedBy: null,
    };
    await render();

    await click(buttons('Enviar todos los listos (2)')[0]);

    expect(calls.map(c => c.key)).toContain(`POST ${BASE}/send-ready`);
    expect(toast.success).toHaveBeenCalledWith('Enviados: 1 · actualizados: 0 · anulados o borrados: 1 · con problema: 0');
    expect(text()).toContain('Quedan 3 documentos por enviar');
  });

  it('says why a pass stopped early, in words', async () => {
    replies[`POST ${BASE}/send-ready`] = {
      processed: 1, created: 0, updated: 0, voided: 0, deleted: 0, failed: 1, blocked: 0,
      attachmentsSent: 0, attachmentsFailed: 0, remaining: 4, stoppedBy: 'RATE_LIMITED',
    };
    await render();

    await click(buttons('Enviar todos los listos (2)')[0]);

    expect(text()).toContain('QuickBooks pidió esperar (demasiadas solicitudes). Lo que falta sale en la siguiente pasada.');
  });

  it('never turns the automatic sender on without a confirmation', async () => {
    replies[`PUT ${BASE}/settings`] = { ...SETTINGS, autoSend: true };
    await render();
    const toggle = document.querySelector('[role=switch]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    await click(toggle);
    expect(text()).toContain('¿Encender el envío automático?');
    expect(text()).toContain('Cada 2 minutos');
    await click(buttons('Cancelar')[0]);
    expect(calls.some(c => c.key.startsWith('PUT'))).toBe(false);

    await click(document.querySelector('[role=switch]') as HTMLButtonElement);
    await click(buttons('Sí, encender')[0]);

    expect(calls.find(c => c.key === `PUT ${BASE}/settings`)?.body).toEqual({ cutoverDate: '2026-09-20', autoSend: true });
  });

  it('says a one-minute interval in the singular, in both languages', async () => {
    // Seen in the browser walk with the sender every 40 s (shown as 1 min):
    // the confirmation read "Cada 1 minutos".
    current = overview(undefined, { ...SETTINGS, autoSendIntervalMinutes: 1 });
    await render();
    await click(document.querySelector('[role=switch]') as HTMLButtonElement);
    expect(text()).toContain('Cada minuto BuildTrack enviará');
    expect(text()).not.toContain('1 minutos');
    await click(buttons('Cancelar')[0]);

    await act(async () => { await i18n.changeLanguage('en'); });
    await click(document.querySelector('[role=switch]') as HTMLButtonElement);
    expect(text()).toContain('Every minute BuildTrack will send');
    expect(text()).not.toContain('1 minutes');
  });

  it('turns it off at once, and keeps the switch off until there is a cut-over date', async () => {
    current = overview(undefined, { ...SETTINGS, autoSend: true, autoSendChangedBy: 'admin', autoSendChangedAt: '2026-09-25T20:00:00Z' });
    replies[`PUT ${BASE}/settings`] = SETTINGS;
    await render();
    expect(text()).toContain('Encendido · cada 2 min');
    expect(text()).toContain('Encendido por admin');

    await click(document.querySelector('[role=switch]') as HTMLButtonElement);
    expect(calls.find(c => c.key === `PUT ${BASE}/settings`)?.body).toEqual({ cutoverDate: '2026-09-20', autoSend: false });

    await act(async () => root.unmount());
    current = overview([], { ...SETTINGS, cutoverDate: null });
    await render();
    expect((document.querySelector('[role=switch]') as HTMLButtonElement).disabled).toBe(true);
    expect(text()).toContain('Elige primero la fecha de corte.');
    expect(buttons('Enviar todos los listos')[0].disabled).toBe(true);
  });

  it('saves a new cut-over date', async () => {
    replies[`PUT ${BASE}/settings`] = { ...SETTINGS, cutoverDate: '2026-09-01' };
    await render();
    const input = document.getElementById('qb-cutover') as HTMLInputElement;

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, '2026-09-01');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click(buttons('Guardar fecha')[0]);

    expect(calls.find(c => c.key === `PUT ${BASE}/settings`)?.body).toEqual({ cutoverDate: '2026-09-01', autoSend: false });
  });

  it('filters by state and type through the server', async () => {
    await render();

    await click([...document.querySelectorAll('[role=tab]')].find(b => b.textContent === 'Bloqueados') as HTMLElement);
    expect(calls.map(c => c.key)).toContain(`GET ${BASE}?state=BLOCKED&page=0&size=25`);

    const select = document.querySelector('select') as HTMLSelectElement;
    await act(async () => {
      select.value = 'BILL';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await flush();
    expect(calls.map(c => c.key)).toContain(`GET ${BASE}?type=BILL&state=BLOCKED&page=0&size=25`);
  });

  it('shows why a send was refused', async () => {
    replies[`POST ${BASE}/INVOICE/5/send`] = new Error('Ya hay un envío en curso para tu empresa. Espera a que termine.');
    await render();

    await click(buttonIn(rowOf('INV-2026-0005'), 'Enviar'));

    expect(text()).toContain('Ya hay un envío en curso para tu empresa. Espera a que termine.');
    expect(document.querySelector('[data-testid="quickbooks-sync-error"]')).toBeTruthy();
  });

  it('offers to create again a document someone deleted inside QuickBooks', async () => {
    current = overview([row({ type: 'INVOICE', docId: 8, number: 'INV-2026-0008', state: 'BLOCKED', reasons: ['QBO_DELETED'], qboId: '147' })]);
    replies[`POST ${BASE}/INVOICE/8/send`] = row({ type: 'INVOICE', docId: 8, number: 'INV-2026-0008', state: 'SENT', qboId: '151' });
    await render();

    expect(text()).toContain('Alguien la borró dentro de QuickBooks');
    await click(buttons('Volver a crear')[0]);

    expect(calls.map(c => c.key)).toContain(`POST ${BASE}/INVOICE/8/send`);
  });

  it('asks for the company preferences before anything is sent with a guess', async () => {
    current = overview(undefined, { ...SETTINGS, preferencesRead: false });
    await render();

    expect(text()).toContain('Todavía no se leyeron las preferencias de facturación');
    await click(buttons('Ir a Vincular')[0]);
    expect(openMapping).toHaveBeenCalledWith('clients');
  });

  it('stays failed, with a retry, when the list cannot be loaded', async () => {
    replies[`GET ${BASE}`] = new Error('offline');
    await render();

    expect(document.querySelector('[data-testid="quickbooks-sync-load-error"]')).toBeTruthy();
    delete replies[`GET ${BASE}`];
    await click(buttons('Reintentar')[0]);
    expect(text()).toContain('INV-2026-0005');
  });
});
