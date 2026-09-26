// BuildTrack — the QuickBooks section: what it offers in each state of the
// link, and that its buttons reach the right endpoints.
//
// The backend is faked at the HTTP helper, and the one navigation this screen
// makes — leaving for Intuit's consent page — is faked at openIntuitConsent,
// since jsdom cannot follow it.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuickBooksOutcome, QuickBooksStatus } from '../../services/quickbooks';

vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  api: (path: string, init?: RequestInit) => fakeApi(path, init),
}));
vi.mock('../../services/quickbooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/quickbooks')>()),
  openIntuitConsent: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { QuickBooksSection } from './QuickBooksSection';
import { openIntuitConsent } from '../../services/quickbooks';
import i18n from '../../../i18n';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const BASE = '/api/v1/admin/integrations/quickbooks';

const NOT_CONNECTED: QuickBooksStatus = {
  configured: true,
  environment: 'SANDBOX',
  state: 'NOT_CONNECTED',
  companyName: null,
  realmId: null,
  connectedAt: null,
  connectedBy: null,
  lastRefreshedAt: null,
  refreshTokenExpiresAt: null,
  refreshTokenHardExpiresAt: null,
  lastError: null,
};

const ACTIVE: QuickBooksStatus = {
  ...NOT_CONNECTED,
  state: 'ACTIVE',
  companyName: 'Constructora Peña S.A.',
  realmId: '9130000001',
  connectedAt: '2026-09-25T15:00:00Z',
  connectedBy: 'admin',
  lastRefreshedAt: '2026-09-25T15:00:00Z',
  refreshTokenExpiresAt: '2027-01-03T15:00:00Z',
  refreshTokenHardExpiresAt: '2031-09-24T15:00:00Z',
};

/** An unread company: the mapping block renders its "refresh first" state and no vendor list. */
const COMPANY_UNREAD = {
  connected: true, realmId: '9130000001', companyName: 'Constructora Peña S.A.', plan: null, offeringSku: null,
  country: null, homeCurrency: null, projectsEnabled: null, classTracking: null, locationTracking: null,
  expensesByCustomer: null, jobTracking: null, profileReadAt: null, directoryRefreshedAt: null, directoryCounts: {},
};

let statusReply: QuickBooksStatus = NOT_CONNECTED;
let replies: Record<string, unknown> = {};
const calls: string[] = [];

async function fakeApi(path: string, init?: RequestInit): Promise<unknown> {
  const key = `${(init?.method ?? 'GET').toUpperCase()} ${path}`;
  calls.push(key);
  if (key in replies) {
    const reply = replies[key];
    if (reply instanceof Error) throw reply;
    return reply;
  }
  if (key === `GET ${BASE}`) return statusReply;
  if (key === `GET ${BASE}/mappings`) {
    return { company: COMPANY_UNREAD, clients: [], projects: [], vendors: [], categories: [], invoiceItem: [] };
  }
  throw new Error(`unscripted ${key}`);
}

let host: HTMLDivElement;
let root: Root;

async function flush() {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
}

async function render(outcome: QuickBooksOutcome | null = null) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(<QuickBooksSection outcome={outcome} />); });
  await flush();
}

function text(): string {
  return document.body.textContent ?? '';
}

function button(label: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === label) as HTMLButtonElement | undefined;
}

async function click(label: string) {
  const b = button(label);
  expect(b, `button "${label}"`).toBeTruthy();
  await act(async () => { b!.click(); });
  await flush();
}

beforeEach(async () => {
  await i18n.changeLanguage('es');
  statusReply = NOT_CONNECTED;
  replies = {};
  calls.length = 0;
  vi.mocked(openIntuitConsent).mockClear();
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  document.body.innerHTML = '';
});

describe('QuickBooksSection', () => {
  it('explains a server without Intuit keys instead of offering a button that cannot work', async () => {
    statusReply = { ...NOT_CONNECTED, configured: false };
    await render();

    expect(text()).toContain('Falta configurar el servidor');
    expect(button('Conectar con QuickBooks')).toBeUndefined();
  });

  it('sends the browser to the consent URL the server minted', async () => {
    replies[`POST ${BASE}/connect`] = { authorizationUrl: 'https://appcenter.intuit.com/connect/oauth2?state=abc' };
    await render();

    expect(text()).toContain('Tu QuickBooks todavía no está conectado');
    expect(text()).toContain('solo se puede conectar una empresa sandbox');
    await click('Conectar con QuickBooks');

    expect(calls).toContain(`POST ${BASE}/connect`);
    expect(openIntuitConsent).toHaveBeenCalledWith('https://appcenter.intuit.com/connect/oauth2?state=abc');
  });

  it('shows why connecting failed and lets the admin try again', async () => {
    replies[`POST ${BASE}/connect`] = new Error('La integración con QuickBooks todavía no está configurada en el servidor.');
    await render();

    await click('Conectar con QuickBooks');

    expect(openIntuitConsent).not.toHaveBeenCalled();
    expect(text()).toContain('todavía no está configurada en el servidor');
    expect(button('Conectar con QuickBooks')?.disabled).toBe(false);
  });

  it('names the connected company and tests the link on demand', async () => {
    statusReply = ACTIVE;
    replies[`POST ${BASE}/test`] = { ...ACTIVE, companyName: 'Renamed Co' };
    await render();

    expect(text()).toContain('Constructora Peña S.A.');
    expect(text()).toContain('9130000001');
    expect(document.querySelector('[data-testid="quickbooks-state"]')?.textContent).toContain('Conectado');
    await click('Probar conexión');

    expect(calls).toContain(`POST ${BASE}/test`);
    expect(text()).toContain('Renamed Co');
  });

  it('asks for a reconnect when Intuit rejected the permission, and hides the test button', async () => {
    statusReply = { ...ACTIVE, state: 'NEEDS_RECONNECT', lastError: 'REFRESH_REJECTED' };
    await render();

    expect(text()).toContain('La conexión dejó de funcionar');
    expect(text()).toContain('Intuit rechazó el permiso');
    expect(button('Volver a conectar')).toBeTruthy();
    expect(button('Probar conexión')).toBeUndefined();
  });

  it('after an environment switch, only offers disconnecting — a reconnect would hit the other company', async () => {
    statusReply = { ...ACTIVE, state: 'NEEDS_RECONNECT', lastError: 'ENVIRONMENT_CHANGED' };
    await render();

    expect(text()).toContain('cambió de ambiente');
    expect(button('Volver a conectar')).toBeUndefined();
    expect(button('Desconectar')).toBeTruthy();
  });

  it('disconnects only after confirming, then shows the empty state', async () => {
    statusReply = ACTIVE;
    replies[`POST ${BASE}/disconnect`] = NOT_CONNECTED;
    await render();

    await click('Desconectar');
    expect(text()).toContain('¿Desconectar?');
    expect(calls).not.toContain(`POST ${BASE}/disconnect`);

    await click('Sí, desconectar');

    expect(calls).toContain(`POST ${BASE}/disconnect`);
    expect(text()).toContain('Tu QuickBooks todavía no está conectado');
  });

  it('greets the return from Intuit with the outcome, and drops it once the admin acts again', async () => {
    statusReply = ACTIVE;
    replies[`POST ${BASE}/disconnect`] = NOT_CONNECTED;
    await render('CONNECTED');
    expect(text()).toContain('Tu QuickBooks quedó conectado.');

    await click('Desconectar');
    await click('Sí, desconectar');

    // Found live in OFJR on 2026-09-25: the "connected" banner stayed above
    // the just-disconnected card.
    expect(text()).not.toContain('Tu QuickBooks quedó conectado.');
    expect(text()).toContain('Tu QuickBooks todavía no está conectado');
  });

  it('explains a company held by another constructora in words, not a code', async () => {
    await render('REALM_IN_USE');

    expect(text()).toContain('No se conectó');
    expect(text()).toContain('ya está conectada a otra constructora');
    expect(text()).not.toContain('REALM_IN_USE');
  });

  it('stays failed, with a retry, when the status cannot be loaded', async () => {
    replies[`GET ${BASE}`] = new Error('network');
    await render();

    expect(document.querySelector('[data-testid="quickbooks-load-error"]')).not.toBeNull();
    expect(button('Conectar con QuickBooks')).toBeUndefined();

    delete replies[`GET ${BASE}`];
    await click('Reintentar');
    expect(button('Conectar con QuickBooks')).toBeTruthy();
  });
});
