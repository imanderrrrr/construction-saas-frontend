// BuildTrack — the mapping screen: it reads the local copy, offers exactly
// the actions each row's state allows, and treats the per-company refresh
// brake as information, not as a failure.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuickBooksCompany, QuickBooksMappingOverview, QuickBooksMappingRow } from '../../services/quickbooks';

vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  api: (path: string, init?: RequestInit) => fakeApi(path, init),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { QuickBooksMapping } from './QuickBooksMapping';
import { ApiError } from '../../lib/api';
import i18n from '../../../i18n';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const BASE = '/api/v1/admin/integrations/quickbooks';

const COMPANY: QuickBooksCompany = {
  connected: true,
  realmId: '9130000009',
  companyName: 'Constructora Peña S.A.',
  plan: 'PLUS',
  offeringSku: 'QuickBooks Online Plus',
  country: 'US',
  homeCurrency: 'USD',
  projectsEnabled: false,
  classTracking: false,
  locationTracking: false,
  expensesByCustomer: true,
  jobTracking: 'SUB_CUSTOMERS',
  profileReadAt: '2026-09-25T16:00:00Z',
  directoryRefreshedAt: '2026-09-25T16:00:00Z',
  directoryCounts: { CUSTOMER: 29, VENDOR: 26, ACCOUNT: 89, ITEM: 18 },
};

const row = (partial: Partial<QuickBooksMappingRow> & Pick<QuickBooksMappingRow, 'type' | 'localKey' | 'localLabel'>): QuickBooksMappingRow => ({
  detail: null, link: null, suggestion: null, billCount: null, billTotalCents: null, ...partial,
});

const OVERVIEW: QuickBooksMappingOverview = {
  company: COMPANY,
  clients: [
    row({ type: 'CLIENT', localKey: '1', localLabel: 'Freeman Sporting Goods',
      suggestion: { qboId: '7', name: 'Freeman Sporting Goods', fullName: null, kind: 'CUSTOMER', isProject: false, isSubCustomer: false, accountType: null, active: true } }),
    row({ type: 'CLIENT', localKey: '2', localLabel: 'Cliente Demo' }),
  ],
  projects: [
    row({ type: 'PROJECT', localKey: '10', localLabel: 'Torre Norte', detail: 'Freeman Sporting Goods',
      link: { qboId: '40', qboName: 'Freeman Sporting Goods:Torre Norte', createdInQbo: false, linkedBy: 'admin', stillActive: true } }),
  ],
  vendors: [
    row({ type: 'VENDOR', localKey: 'home depot', localLabel: 'Home Depot', billCount: 3, billTotalCents: 17_500,
      link: { qboId: '56', qboName: 'Home Depot', createdInQbo: false, linkedBy: 'admin', stillActive: false } }),
  ],
  categories: [
    row({ type: 'PAYABLE_CATEGORY', localKey: 'MATERIALS', localLabel: 'MATERIALS',
      suggestion: { qboId: '63', name: 'Job Materials', fullName: 'Job Expenses:Job Materials', kind: 'ACCOUNT', isProject: false, isSubCustomer: false, accountType: 'Expense', active: true } }),
  ],
  invoiceItem: [row({ type: 'INVOICE_ITEM', localKey: 'DEFAULT', localLabel: 'DEFAULT' })],
};

let overview: QuickBooksMappingOverview = OVERVIEW;
let replies: Record<string, unknown> = {};
const calls: { key: string; body?: unknown }[] = [];

async function fakeApi(path: string, init?: RequestInit): Promise<unknown> {
  const key = `${(init?.method ?? 'GET').toUpperCase()} ${path}`;
  calls.push({ key, body: init?.body ? JSON.parse(String(init.body)) : undefined });
  if (key in replies) {
    const reply = replies[key];
    if (reply instanceof Error) throw reply;
    return reply;
  }
  if (key === `GET ${BASE}/mappings`) return overview;
  if (key.startsWith(`GET ${BASE}/mappings/options`)) {
    return [
      { qboId: '7', name: 'Freeman Sporting Goods', fullName: null, kind: 'CUSTOMER', isProject: false, isSubCustomer: false, accountType: null, active: true },
      { qboId: '9', name: '55 Twin Lane', fullName: 'Freeman Sporting Goods:55 Twin Lane', kind: 'CUSTOMER', isProject: false, isSubCustomer: true, accountType: null, active: true },
    ];
  }
  throw new Error(`unscripted ${key}`);
}

let host: HTMLDivElement;
let root: Root;

async function flush(ms = 0) {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, ms)); });
}

async function render() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(<QuickBooksMapping />); });
  await flush();
}

const text = () => document.body.textContent ?? '';

function buttons(label: string): HTMLButtonElement[] {
  return [...document.querySelectorAll('button')].filter(b => b.textContent?.trim() === label) as HTMLButtonElement[];
}

async function click(el: HTMLElement | undefined, what: string) {
  expect(el, what).toBeTruthy();
  await act(async () => { el!.click(); });
  await flush();
}

async function tab(label: string) {
  const t = [...document.querySelectorAll('[role="tab"]')].find(b => b.textContent?.startsWith(label)) as HTMLElement | undefined;
  await click(t, `tab ${label}`);
}

beforeEach(async () => {
  await i18n.changeLanguage('es');
  overview = OVERVIEW;
  replies = {};
  calls.length = 0;
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  document.body.innerHTML = '';
});

describe('QuickBooksMapping', () => {
  it('describes the company as read: plan, what is on, how obras live there, and the local counts', async () => {
    await render();

    expect(text()).toContain('QuickBooks Online Plus');
    expect(text()).toContain('cada obra se registra como subcliente');
    expect(text()).toContain('29 clientes y obras');
    expect(text()).toContain('26 proveedores');
  });

  it('asks for a first refresh when the company was never read, without listing anything', async () => {
    overview = { ...OVERVIEW, company: { ...COMPANY, profileReadAt: null, directoryRefreshedAt: null, plan: null, directoryCounts: {} } };
    await render();

    expect(text()).toContain('Todavía no se leyó la empresa');
    expect(text()).toContain('Primero presiona «Actualizar desde QuickBooks»');
    expect(buttons('Aceptar')).toHaveLength(0);
  });

  it('refreshes from QuickBooks, then re-reads the overview', async () => {
    replies[`POST ${BASE}/company/refresh`] = COMPANY;
    await render();

    await click(buttons('Actualizar desde QuickBooks')[0], 'refresh');

    const keys = calls.map(c => c.key);
    expect(keys.indexOf(`POST ${BASE}/company/refresh`)).toBeGreaterThan(-1);
    expect(keys.lastIndexOf(`GET ${BASE}/mappings`)).toBeGreaterThan(keys.indexOf(`POST ${BASE}/company/refresh`));
  });

  it('says when the refresh brake lifts instead of showing a bare error', async () => {
    replies[`POST ${BASE}/company/refresh`] = new ApiError(429, 'Demasiadas solicitudes', undefined, 'QUICKBOOKS_REFRESH_COOLDOWN', 42);
    await render();

    await click(buttons('Actualizar desde QuickBooks')[0], 'refresh');

    expect(text()).toContain('Puedes volver a actualizar en 42 s');
    expect(text()).not.toContain('Demasiadas solicitudes');
  });

  it('offers accept + pick + create on an unlinked row with a suggestion, and change + unlink on a linked one', async () => {
    await render();

    // Clients tab is first: Freeman has a suggestion, Cliente Demo has none.
    expect(text()).toContain('Sugerencia');
    expect(buttons('Aceptar')).toHaveLength(1);
    expect(buttons('Elegir en QuickBooks')).toHaveLength(2);
    expect(buttons('Crear en QuickBooks')).toHaveLength(2);

    await tab('Obras');
    expect(text()).toContain('Freeman Sporting Goods:Torre Norte');
    expect(buttons('Cambiar')).toHaveLength(1);
    expect(buttons('Quitar vínculo')).toHaveLength(1);
    expect(buttons('Crear en QuickBooks')).toHaveLength(0);
  });

  it('accepting a suggestion links exactly that record', async () => {
    const linked: QuickBooksMappingOverview = {
      ...OVERVIEW,
      clients: [{ ...OVERVIEW.clients[0], suggestion: null, link: { qboId: '7', qboName: 'Freeman Sporting Goods', createdInQbo: false, linkedBy: 'admin', stillActive: true } }, OVERVIEW.clients[1]],
    };
    replies[`POST ${BASE}/mappings/link`] = linked;
    await render();

    await click(buttons('Aceptar')[0], 'accept');

    const call = calls.find(c => c.key === `POST ${BASE}/mappings/link`);
    expect(call?.body).toEqual({ type: 'CLIENT', localKey: '1', qboId: '7' });
    expect(text()).toContain('Vinculado a');
    expect(buttons('Aceptar')).toHaveLength(0);
  });

  it('warns when a linked record is no longer active in QuickBooks, and shows the vendor total', async () => {
    await render();
    await tab('Proveedores');

    expect(text()).toContain('Inactivo en QuickBooks');
    expect(text()).toContain('3 cuentas por pagar');
    expect(text()).toContain('175');
  });

  it('accepts all suggestions of the current tab in one call', async () => {
    replies[`POST ${BASE}/mappings/accept-suggestions?type=CLIENT`] = { linked: 1, overview: OVERVIEW };
    await render();

    await click(buttons('Aceptar 1 sugerencia')[0], 'accept all');

    expect(calls.map(c => c.key)).toContain(`POST ${BASE}/mappings/accept-suggestions?type=CLIENT`);
  });

  it('picks a record from the local copy and links it', async () => {
    replies[`POST ${BASE}/mappings/link`] = OVERVIEW;
    await render();

    await click(buttons('Elegir en QuickBooks')[1], 'pick for Cliente Demo');
    await flush(250); // the picker debounces its search

    expect(text()).toContain('55 Twin Lane');
    const option = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Freeman Sporting Goods:55 Twin Lane')) as HTMLElement | undefined;
    await click(option, 'option');

    const call = calls.find(c => c.key === `POST ${BASE}/mappings/link`);
    expect(call?.body).toEqual({ type: 'CLIENT', localKey: '2', qboId: '9' });
  });

  it('labels categories and the invoice item in the panel language, not with enum names', async () => {
    await render();
    await tab('Categorías');
    expect(text()).toContain('Materiales');
    expect(text()).not.toContain('MATERIALS');

    await tab('Facturación');
    expect(text()).toContain('Servicio para las facturas a clientes');
    expect(text()).not.toContain('DEFAULT');
  });
});
