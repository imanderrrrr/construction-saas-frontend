// BuildTrack — what the issue window refuses to send.
//
// The form it replaces sent `parseFloat(li.quantity) || 1`, so a quantity of
// 0 became 1 in silence (0 is falsy) and a negative one travelled as typed;
// a discount larger than the subtotal left the on-screen total at $0 and was
// only caught by the server; and the billable ceiling — the one number that
// prevents the rejection — was never shown at all, only quoted back inside
// the 400 that refused the document, in English.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `t` must keep one identity across renders: the real hook returns a stable
// function, and the screen puts it in a useCallback dependency list that
// feeds an effect. A fresh closure per render would loop forever.
vi.mock('react-i18next', () => {
  const t = (key: string, opts?: Record<string, unknown>) =>
    opts && typeof opts === 'object' && !Array.isArray(opts)
      ? `${key}|${Object.entries(opts).map(([k, v]) => `${k}=${v}`).join(',')}`
      : key;
  const i18n = { language: 'es' };
  return {
    useTranslation: () => ({ t, i18n }),
    Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    initReactI18next: { type: '3rdParty', init: () => {} },
  };
});
vi.mock('../../helpers/exportInvoicePdf', () => ({
  invoicePdfPreviewUrl: () => 'blob:preview',
  downloadInvoicePdf: vi.fn(),
}));
vi.mock('../../lib/tourScope', () => ({ useTourScopeWhileMounted: () => {} }));

const createReceivable = vi.fn();
vi.mock('../../services/finance', () => ({
  createReceivable: (...a: unknown[]) => createReceivable(...a),
}));
const listProjects = vi.fn();
vi.mock('../../services/projects', () => ({ listProjects: (...a: unknown[]) => listProjects(...a) }));
const listClients = vi.fn();
vi.mock('../../services/clients', () => ({ listClients: (...a: unknown[]) => listClients(...a) }));
vi.mock('../../services/invoiceBranding', () => ({
  loadInvoiceIssuer: () => Promise.resolve({ name: 'Constructora Peña S.A.' }),
}));

import { InvoiceWindow } from './InvoiceWindow';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** Torre Norte: $175,000 contract, $40,000 billed — $135,000 of room. */
const TORRE = {
  id: 7, name: 'Torre Norte', status: 'ACTIVE', clientId: 3, costCode: 'TN-01',
  client: { id: 3, name: 'Grupo Marisol' },
  revisedContractCents: 175_000_00, invoicedCents: 40_000_00,
};
/** Residencial Sur: $260,000 contract, all of it billed. */
const SUR = {
  id: 9, name: 'Residencial Sur', status: 'ACTIVE', clientId: 3, costCode: 'RS-01',
  client: { id: 3, name: 'Grupo Marisol' },
  revisedContractCents: 260_000_00, invoicedCents: 260_000_00,
};
/** Missing its cost code: the server refuses it with PROJECT_INCOMPLETE_FOR_ACCOUNTING. */
const BODEGA = {
  id: 11, name: 'Bodega Km 22', status: 'ACTIVE', clientId: null, costCode: null,
  client: null, revisedContractCents: 50_000_00, invoicedCents: 0,
};

async function flush(ms = 0) {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, ms)); });
}

function typeInto(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('InvoiceWindow', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    listClients.mockResolvedValue({ content: [{ id: 3, name: 'Grupo Marisol', contact: null, email: null }], totalElements: 1 });
    listProjects.mockImplementation(({ status }: { status: string }) =>
      Promise.resolve({ content: status === 'ACTIVE' ? [TORRE, SUR, BODEGA] : [], totalElements: 3 }));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  async function mount() {
    await act(async () => {
      root.render(<InvoiceWindow onClose={() => {}} onCreated={() => {}} />);
    });
    await flush();
  }

  /** Open a picker, wait for the debounce, and click the option by label. */
  async function pick(testId: string, label: string) {
    const input = container.querySelector<HTMLInputElement>(`[data-testid="${testId}"]`)!;
    // React listens for focusin, which HTMLElement.focus() fires in jsdom.
    await act(async () => { input.focus(); });
    await flush(350);
    await flush();
    const option = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.startsWith(label))!;
    await act(async () => { option.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await flush();
  }

  function line(index: number) {
    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>('input'));
    // description, price, quantity — in DOM order, three per line row. The
    // stubbed `t` echoes the key it was handed, namespace prefix and all.
    const start = inputs.findIndex(i => i.placeholder === 'finance:invoice.dialog.itemDescPlaceholder');
    return {
      description: inputs[start + index * 3],
      price: inputs[start + index * 3 + 1],
      quantity: inputs[start + index * 3 + 2],
    };
  }

  const submit = () => container.querySelector<HTMLButtonElement>('[data-testid="invoice-submit"]')!;

  it('shows what is left to bill the moment a jobsite is chosen — before anything is typed', async () => {
    await mount();
    expect(container.querySelector('[data-testid="invoice-ceiling"]')).toBeNull();
    await pick('invoice-project', 'Torre Norte');
    expect(container.querySelector('[data-testid="invoice-ceiling-amount"]')!.textContent).toBe('$135,000');
  });

  it('never offers a jobsite the server would refuse, and says why', async () => {
    await mount();
    const input = container.querySelector<HTMLInputElement>('[data-testid="invoice-project"]')!;
    await act(async () => { input.focus(); });
    await flush(350);
    await flush();
    const bodega = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.startsWith('Bodega Km 22'))!;
    expect(bodega.disabled).toBe(true);
    expect(bodega.textContent).toContain('invoice.picker.notBillable');
  });

  it('keeps a quantity of 0 at 0 and refuses to issue', async () => {
    await mount();
    await pick('invoice-client', 'Grupo Marisol');
    await pick('invoice-project', 'Torre Norte');
    await act(async () => {
      typeInto(line(0).description, 'Cimentación');
      typeInto(line(0).price, '4500');
    });
    await act(async () => { typeInto(line(0).quantity, '0'); });

    // The old form silently billed one unit here.
    expect(container.querySelector('[data-testid="invoice-total"]')!.textContent).toBe('$0.00');
    expect(submit().disabled).toBe(true);
    expect(container.textContent).toContain('invoice.validation.quantity');
  });

  it('refuses a negative quantity instead of sending it as typed', async () => {
    await mount();
    await pick('invoice-project', 'Torre Norte');
    await act(async () => {
      typeInto(line(0).description, 'Cimentación');
      typeInto(line(0).price, '4500');
    });
    await act(async () => { typeInto(line(0).quantity, '-2'); });
    expect(submit().disabled).toBe(true);
    expect(createReceivable).not.toHaveBeenCalled();
  });

  it('flags a discount larger than the subtotal on screen, not at the server', async () => {
    await mount();
    await pick('invoice-client', 'Grupo Marisol');
    await pick('invoice-project', 'Torre Norte');
    await act(async () => {
      typeInto(line(0).description, 'Cimentación');
      typeInto(line(0).price, '12500');
      typeInto(line(0).quantity, '1');
    });
    const discount = container.querySelector<HTMLInputElement>('[aria-label="finance:invoice.dialog.discount"]')!;
    await act(async () => { typeInto(discount, '14000'); });

    expect(container.textContent).toContain('invoice.validation.discountTooBig');
    expect(submit().disabled).toBe(true);
  });

  it('stops an invoice above the ceiling before the server does, and offers the way out', async () => {
    await mount();
    await pick('invoice-client', 'Grupo Marisol');
    await pick('invoice-project', 'Residencial Sur');
    // Fully billed: no invoice fits, and the button explains the escape.
    expect(container.querySelector('[data-testid="invoice-ceiling-amount"]')!.textContent).toBe('$0');
    expect(container.textContent).toContain('invoice.ceiling.switchToCor');
    await act(async () => {
      typeInto(line(0).description, 'Acabados');
      typeInto(line(0).price, '1000');
      typeInto(line(0).quantity, '1');
    });
    expect(submit().disabled).toBe(true);
    expect(createReceivable).not.toHaveBeenCalled();
  });

  it('lets a change order past the ceiling, because that is what it is for', async () => {
    await mount();
    await pick('invoice-client', 'Grupo Marisol');
    await pick('invoice-project', 'Residencial Sur');
    const corTab = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'finance:invoice.type.changeOrder')!;
    await act(async () => { corTab.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await act(async () => {
      typeInto(container.querySelector<HTMLInputElement>('#inv-description')!, 'Muro de contención adicional');
      typeInto(line(0).description, 'Muro de contención');
      typeInto(line(0).price, '6200');
      typeInto(line(0).quantity, '1');
    });
    expect(submit().disabled).toBe(false);
  });

  it('sends the quantity typed, with no fallback to 1', async () => {
    createReceivable.mockResolvedValue({
      id: 1, documentType: 'INVOICE', invoiceNumber: 'INV-2026-7', client: 'Grupo Marisol',
      project: 'Torre Norte', description: null, issuedDate: '2026-09-07', dueDate: '2026-10-07',
      lineItems: [], subtotal: 9000, discount: 0, taxRate: 0, tax: 0, amount: 9000, notes: null,
    });
    await mount();
    await pick('invoice-client', 'Grupo Marisol');
    await pick('invoice-project', 'Torre Norte');
    await act(async () => {
      typeInto(line(0).description, 'Cimentación');
      typeInto(line(0).price, '4500');
    });
    await act(async () => { typeInto(line(0).quantity, '2'); });
    await act(async () => { submit().dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await flush();

    expect(createReceivable).toHaveBeenCalledTimes(1);
    expect(createReceivable.mock.calls[0][0].lineItems).toEqual([
      { description: 'Cimentación', quantity: 2, unitPrice: 4500 },
    ]);
    // Blank means "let the sequence number it": no placeholder travels.
    expect(createReceivable.mock.calls[0][0].invoiceNumber).toBeUndefined();
  });
});
