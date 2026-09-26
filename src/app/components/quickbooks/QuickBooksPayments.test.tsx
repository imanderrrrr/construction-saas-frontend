// BuildTrack — the "Pagos" tab (QuickBooks phase 4): the switch is never
// turned on without saying what changes, "Actualizar pagos" reaches its
// endpoint and says what moved, and what was read — notices, errors, local
// payments that no longer count, the last payments — is said in words. A
// refusal is a toast, never a band pushed in on top of the section.
//
// The backend is faked at the HTTP helper, like the other QuickBooks tabs.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuickBooksPaymentsStatus } from '../../services/quickbooks';

vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  api: (path: string, init?: RequestInit) => fakeApi(path, init),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { QuickBooksPayments } from './QuickBooksPayments';
import { toast } from 'sonner';
import i18n from '../../../i18n';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const BASE = '/api/v1/admin/integrations/quickbooks/payments';
const WEBHOOK_URL = 'https://api.example.test/api/v1/integrations/quickbooks/webhooks';

const OFF: QuickBooksPaymentsStatus = {
  connected: true,
  enabled: false,
  changedBy: null,
  changedAt: null,
  intervalMinutes: 60,
  readAt: null,
  cursor: null,
  lastError: null,
  running: false,
  webhook: { configured: false, url: WEBHOOK_URL, lastEventAt: null, pendingEvents: 0 },
  localPaymentsDocuments: 0,
  localPaymentsCents: 0,
  recent: [],
};

const ON: QuickBooksPaymentsStatus = {
  ...OFF,
  enabled: true,
  changedBy: 'admin',
  changedAt: '2026-09-25T20:00:00Z',
  readAt: '2026-09-25T20:05:00Z',
  cursor: '2026-09-25T20:05:00Z',
  webhook: { configured: true, url: WEBHOOK_URL, lastEventAt: '2026-09-25T20:04:00Z', pendingEvents: 1 },
  recent: [
    {
      type: 'INVOICE', docId: 5, number: 'INV-2026-0005', party: 'Cliente Demo', amountCents: 100_00, date: '2026-09-25',
      method: 'Check', reference: 'CHK-1001', qboPaymentId: '157', voided: false, readAt: '2026-09-25T20:05:00Z',
    },
    {
      type: 'BILL', docId: 9, number: 'BILL-2026-0009', party: 'Ferretería Central', amountCents: 30_00, date: '2026-09-25',
      method: 'Credit memo', reference: '5001', qboPaymentId: '161', voided: true, readAt: '2026-09-25T20:06:00Z',
    },
  ],
};

let current: QuickBooksPaymentsStatus = OFF;
let replies: Record<string, unknown> = {};
const calls: Array<{ key: string; body: unknown }> = [];

async function fakeApi(path: string, init?: RequestInit): Promise<unknown> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const key = `${method} ${path}`;
  calls.push({ key, body: init?.body ? JSON.parse(String(init.body)) : undefined });
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
const openSync = vi.fn();

async function flush() {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
}

async function render() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(<QuickBooksPayments onOpenSync={openSync} />); });
  await flush();
}

const text = () => document.body.textContent ?? '';

function button(label: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll('button')].find(b => b.textContent?.trim().startsWith(label)) as HTMLButtonElement | undefined;
}

const toggle = () => document.querySelector('[role=switch]') as HTMLButtonElement;

async function click(el: HTMLElement | undefined) {
  expect(el).toBeTruthy();
  await act(async () => { el!.click(); });
  await flush();
}

beforeEach(async () => {
  await i18n.changeLanguage('es');
  current = OFF;
  replies = {};
  calls.length = 0;
  openSync.mockClear();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  document.body.innerHTML = '';
});

describe('QuickBooksPayments', () => {
  it('off: says payments are recorded in BuildTrack, reads nothing, and explains the notices without asking the tenant to set anything up', async () => {
    await render();

    expect(text()).toContain('Apagado — los pagos se registran en BuildTrack');
    expect(toggle().getAttribute('aria-checked')).toBe('false');
    expect(button('Actualizar pagos')!.disabled).toBe(true);
    expect(text()).toContain('Sin configurar');
    expect(text()).toContain('Los avisos los configura quien administra el servidor de BuildTrack');
    // The platform's set-up is not the constructora's business.
    expect(text()).not.toContain('QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN');
    expect(text()).not.toContain(WEBHOOK_URL);
    expect(text()).toContain('Todavía no se ha leído ningún pago de QuickBooks.');
    expect(calls.map(c => c.key)).toEqual([`GET ${BASE}`]);
  });

  it('turning it on asks first and says what changes; only then it is sent', async () => {
    replies[`PUT ${BASE}/settings`] = ON;
    await render();

    await click(toggle());
    expect(text()).toContain('¿Leer los pagos desde QuickBooks?');
    expect(text()).toContain('En BuildTrack ya no se podrán registrar para esos documentos.');
    expect(calls.map(c => c.key)).not.toContain(`PUT ${BASE}/settings`);

    await click(button('Encender'));

    expect(calls.find(c => c.key === `PUT ${BASE}/settings`)?.body).toEqual({ enabled: true });
    expect(toast.success).toHaveBeenCalledWith('Listo: los pagos ahora se leen de QuickBooks.');
    expect(text()).toContain('Encendido — cada 60 min y cuando QuickBooks avisa de un cambio');
    expect(toggle().getAttribute('aria-checked')).toBe('true');
  });

  it('turning it off needs no confirmation', async () => {
    current = ON;
    replies[`PUT ${BASE}/settings`] = { ...ON, enabled: false };
    await render();

    await click(toggle());

    expect(calls.find(c => c.key === `PUT ${BASE}/settings`)?.body).toEqual({ enabled: false });
    expect(toast.success).toHaveBeenCalledWith('Los pagos se registran otra vez en BuildTrack.');
  });

  it('a refused switch is a toast, and nothing is pushed on top of the section', async () => {
    current = ON;
    replies[`PUT ${BASE}/settings`] = new Error('QuickBooks no está conectado.');
    await render();

    await click(toggle());

    expect(toast.error).toHaveBeenCalledWith('No se pudo completar.', { description: 'QuickBooks no está conectado.' });
    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(0);
    expect(document.querySelector('[data-testid="quickbooks-payments"]')!.firstElementChild!.getAttribute('data-testid'))
      .toBe('quickbooks-payments-settings');
  });

  it('"Actualizar pagos" reads once and says how many documents moved', async () => {
    current = ON;
    replies[`POST ${BASE}/refresh`] = {
      result: { mode: 'CDC', reads: 1, paymentsRead: 2, documentsChecked: 3, documentsUpdated: 2, failed: 0, stoppedBy: null },
      status: ON,
    };
    await render();
    expect(text()).toContain('Solo lo que cambió desde la última (una consulta)');

    await click(button('Actualizar pagos'));

    expect(calls.map(c => c.key)).toContain(`POST ${BASE}/refresh`);
    expect(toast.success).toHaveBeenCalledWith('Pagos leídos: 2 documentos actualizados.');
  });

  it('a read stopped on the way says why, in words, never the code', async () => {
    current = ON;
    replies[`POST ${BASE}/refresh`] = {
      result: { mode: 'CDC', reads: 1, paymentsRead: 0, documentsChecked: 0, documentsUpdated: 0, failed: 0, stoppedBy: 'QUICKBOOKS_UNAVAILABLE' },
      status: { ...ON, lastError: 'QUICKBOOKS_UNAVAILABLE' },
    };
    await render();

    await click(button('Actualizar pagos'));

    expect(toast.error).toHaveBeenCalledWith('La lectura no terminó.', {
      description: 'QuickBooks no respondió. Intenta de nuevo en unos minutos.',
    });
    expect(document.querySelector('[data-testid="quickbooks-payments-last-error"]')?.textContent)
      .toContain('QuickBooks no respondió. Intenta de nuevo en unos minutos.');
    expect(text()).not.toContain('QUICKBOOKS_UNAVAILABLE');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('a code it has no sentence for still reads as words', async () => {
    current = { ...ON, lastError: 'SOMETHING_NEW' };
    await render();

    expect(text()).toContain('La lectura de pagos se detuvo antes de terminar. Intenta de nuevo.');
    expect(text()).not.toContain('SOMETHING_NEW');
  });

  it('while a read of this company runs, "Actualizar pagos" waits', async () => {
    current = { ...ON, running: true };
    await render();

    expect(button('Leyendo…')!.disabled).toBe(true);
  });

  it('lists the last payments read, marking one deleted in QuickBooks, and shows the notices of this company', async () => {
    current = { ...ON, lastError: 'PAYMENTS_APPLY_FAILED' };
    await render();

    expect(text()).toContain('INV-2026-0005');
    expect(text()).toContain('CHK-1001');
    expect(text()).toContain('Pago #157 en QuickBooks');
    expect(text()).toContain('BILL-2026-0009');
    expect(text()).toContain('Nota de crédito');
    expect(text()).toContain('Ya no está en QuickBooks');
    expect(text()).toContain('Activos');
    expect(text()).toContain('1 aviso');
    expect(text()).toContain('Algunos documentos no se pudieron actualizar. La próxima lectura los vuelve a intentar.');
  });

  it('warns about payments recorded in BuildTrack that no longer count, and opens Envíos', async () => {
    current = { ...ON, localPaymentsDocuments: 2, localPaymentsCents: 150_00 };
    await render();

    const band = document.querySelector('[data-testid="quickbooks-payments-local"]');
    expect(band?.textContent).toContain('2 documentos enviados tienen pagos registrados en BuildTrack por');
    expect(band?.textContent).toContain('150.00');

    await click(button('Ver en Envíos'));
    expect(openSync).toHaveBeenCalled();
  });

  it('speaks English too', async () => {
    await i18n.changeLanguage('en');
    current = ON;
    await render();

    expect(text()).toContain('Payments from QuickBooks');
    expect(text()).toContain('Refresh payments');
    expect(text()).toContain('No longer in QuickBooks');
    expect(text()).toContain('Credit memo');
  });
});
