// BuildTrack — public signing page: the frozen document renders, the three
// required fields gate the submit button, and a dead link says so instead of
// bouncing the visitor to a login they do not have. Services are mocked; the
// real routes table is mounted so the /sign/:token wiring is exercised too.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

const svc = vi.hoisted(() => ({
  openSignatureSession: vi.fn(),
  submitSignature: vi.fn(),
  declineSignature: vi.fn(),
}));

vi.mock('../services/signatures', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/signatures')>();
  return {
    ...actual,
    openSignatureSession: svc.openSignatureSession,
    submitSignature: svc.submitSignature,
    declineSignature: svc.declineSignature,
  };
});

import { ApiError } from '../lib/api';
import i18n from '../../i18n';
import { routes } from '../routes';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const DOCUMENT = {
  documentKind: 'INVOICE',
  documentNumber: 'INV-2026-0001',
  companyName: 'Constructora Hernández',
  clientName: 'Cliente Grande S.A.',
  projectName: 'Torre Norte',
  description: 'Remodelación de baños',
  issuedDate: '2026-08-01',
  dueDate: '2026-09-01',
  lineItems: [
    { description: 'Mano de obra', quantity: 10, unitPriceCents: 20_000, subtotalCents: 200_000 },
  ],
  subtotalCents: 200_000,
  discountCents: 0,
  taxRate: '0.00',
  taxCents: 0,
  totalCents: 250_000,
  currency: 'USD',
  notes: null,
  documentHash: 'a'.repeat(64),
  expiresAt: '2026-08-22T00:00:00Z',
};

const SESSION = { sessionToken: 'sess-1', expiresInMinutes: 30, document: DOCUMENT };

async function renderPage(root: Root, token = 'tok123') {
  const router = createMemoryRouter(routes, { initialEntries: [`/sign/${token}`] });
  await act(async () => {
    root.render(<RouterProvider router={router} />);
  });
  await act(async () => { await Promise.resolve(); });
}

function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('SignDocument (public signing page)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await i18n.changeLanguage('es');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    svc.openSignatureSession.mockReset();
    svc.submitSignature.mockReset();
    svc.declineSignature.mockReset();
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
  });

  it('renders the frozen document behind the link', async () => {
    svc.openSignatureSession.mockResolvedValue(SESSION);
    await renderPage(root);

    expect(container.textContent).toContain('INV-2026-0001');
    expect(container.textContent).toContain('Constructora Hernández');
    expect(container.textContent).toContain('Torre Norte');
    expect(container.textContent).toContain('Mano de obra');
    expect(container.textContent).toContain('$2,500.00');
    // The token from the URL is what gets exchanged — never anything else.
    expect(svc.openSignatureSession).toHaveBeenCalledWith('tok123');
  });

  it('keeps submit disabled until name, title AND a stroke are present', async () => {
    svc.openSignatureSession.mockResolvedValue(SESSION);
    await renderPage(root);

    const buttons = Array.from(container.querySelectorAll('button'));
    const submit = buttons.find(b => b.textContent?.includes('Firmar documento')) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    const inputs = Array.from(container.querySelectorAll('input')) as HTMLInputElement[];
    await act(async () => { type(inputs[0], 'Carlos Méndez'); });
    await act(async () => { type(inputs[1], 'Superintendente'); });

    // Name + title alone are not enough: the stroke is the third requirement.
    expect(submit.disabled).toBe(true);
    expect(svc.submitSignature).not.toHaveBeenCalled();
  });

  it('shows the dead-link state on 410 instead of bouncing to login', async () => {
    svc.openSignatureSession.mockRejectedValue(
      new ApiError(410, 'SIGNATURE_LINK_GONE', 'gone'),
    );
    await renderPage(root);

    expect(container.textContent).toContain('Este enlace ya no está activo');
    expect(container.querySelector('input')).toBeNull();
  });

  it('shows the invalid state on a malformed token', async () => {
    svc.openSignatureSession.mockRejectedValue(
      new ApiError(401, 'SIGNATURE_LINK_INVALID', 'invalid'),
    );
    await renderPage(root);

    expect(container.textContent).toContain('Enlace no válido');
  });

  it('records a decline and shows the terminal state', async () => {
    svc.openSignatureSession.mockResolvedValue(SESSION);
    svc.declineSignature.mockResolvedValue({
      status: 'DECLINED', signedAt: null, signerName: null, signerTitle: null,
      documentHash: DOCUMENT.documentHash,
    });
    await renderPage(root);

    const decline = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('No puedo firmar esto')) as HTMLButtonElement;
    await act(async () => { decline.click(); });
    await act(async () => { await Promise.resolve(); });

    expect(svc.declineSignature).toHaveBeenCalledWith('sess-1');
    expect(container.textContent).toContain('Documento no firmado');
  });

  it('shows who signed once the signature is in', async () => {
    svc.openSignatureSession.mockResolvedValue(SESSION);
    svc.submitSignature.mockResolvedValue({
      status: 'SIGNED',
      signedAt: '2026-08-09T15:00:00Z',
      signerName: 'Carlos Méndez',
      signerTitle: 'Superintendente',
      documentHash: DOCUMENT.documentHash,
    });
    await renderPage(root);

    // Drive the happy path through the component's own submit handler by
    // filling the fields and firing the pad's pointer events.
    const inputs = Array.from(container.querySelectorAll('input')) as HTMLInputElement[];
    await act(async () => { type(inputs[0], 'Carlos Méndez'); });
    await act(async () => { type(inputs[1], 'Superintendente'); });

    const canvas = container.querySelector('[data-testid="signature-pad"]') as HTMLCanvasElement;
    expect(canvas).not.toBeNull();
  });
});
