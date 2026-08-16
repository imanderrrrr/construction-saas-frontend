// BuildTrack — handing the phone over on site.
//
// What these tests are actually protecting:
//
//  - The supervisor sees the DOCUMENT, not the panel, and the document
//    introduces itself as a T&M sheet rather than as an invoice.
//  - The three fields the client insisted on — signature, name, title — all
//    gate the submit. Any two of them is not a signature.
//  - Signing goes through the public link session (a bearer token), never the
//    encargado's cookie, so the evidence trail is the same as an emailed link.
//  - Finishing hands control back without navigating: the encargado is still
//    exactly where they were, still signed in.
//
// The signature pad itself is stubbed: jsdom has no canvas, so the real pad can
// never produce a PNG here. Its own behaviour belongs to the signatures phase;
// what this file tests is the handoff around it.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';

const svc = vi.hoisted(() => ({
  openSignatureSession: vi.fn(),
  submitSignature: vi.fn(),
  declineSignature: vi.fn(),
}));

vi.mock('../../services/signatures', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/signatures')>();
  return {
    ...actual,
    openSignatureSession: svc.openSignatureSession,
    submitSignature: svc.submitSignature,
    declineSignature: svc.declineSignature,
  };
});

// A pad that can actually produce ink under jsdom.
vi.mock('../signatures/SignaturePad', () => ({
  SignaturePad: ({ onChange }: { onChange: (v: string | null) => void }) => (
    <button type="button" data-testid="fake-pad" onClick={() => onChange('data:image/png;base64,AAAA')}>
      draw
    </button>
  ),
}));

import { TmSignatureHandoff } from './TmSignatureHandoff';
import i18n from '../../../i18n';
import type { TmTicket } from '../../services/tm';
import type { SignatureOutcome } from '../../services/signatures';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const TICKET = {
  id: 42,
  ticketNumber: 'TM-000042',
  projectId: 7,
  projectName: 'Torre Norte',
  description: 'Cambio de madera podrida',
  notes: null,
  workDate: '2026-08-10',
  workerCount: 3,
  hours: 7.5,
  hourlyRate: 20,
  material: 125.5,
  labor: 450,
  total: 575.5,
  status: 'PENDING_SIGNATURE',
  convertible: false,
  editable: false,
  signatureRequestId: 9,
  signatureRequestedAt: '2026-08-11T15:00:00Z',
  signedAt: null,
  signerName: null,
  signerTitle: null,
  declinedAt: null,
  declineReason: null,
  documentHash: 'b'.repeat(64),
  signUrl: 'https://app.example.com/sign/link-token-123',
  changeOrderId: null,
  convertedAt: null,
  convertedBy: null,
  createdBy: 'encargado1',
  createdAt: '2026-08-11T14:00:00Z',
  ageDays: 1,
} satisfies TmTicket;

const DOCUMENT = {
  documentKind: 'TIME_AND_MATERIAL',
  documentNumber: 'TM-000042',
  companyName: 'Constructora Hernández',
  clientName: 'Cliente Grande S.A.',
  projectName: 'Torre Norte',
  description: 'Cambio de madera podrida',
  issuedDate: '2026-08-10',
  // A T&M sheet has no due date — the snapshot omits the key.
  dueDate: '',
  lineItems: [
    { description: 'Mano de obra — 3 persona(s) × 7.50 h', quantity: 22.5, unitPriceCents: 2000, subtotalCents: 45000 },
    { description: 'Material', quantity: 1, unitPriceCents: 12550, subtotalCents: 12550 },
  ],
  subtotalCents: 57550,
  discountCents: 0,
  taxRate: '0.00',
  taxCents: 0,
  totalCents: 57550,
  currency: 'USD',
  notes: null,
  documentHash: 'b'.repeat(64),
  expiresAt: '2026-08-25T00:00:00Z',
};

const SESSION = { sessionToken: 'signing-session-1', expiresInMinutes: 30, document: DOCUMENT };

let container: HTMLDivElement;
let root: Root;
let onFinished: Mock<(outcome: SignatureOutcome) => void>;
let onCancel: Mock<() => void>;
let router: ReturnType<typeof createMemoryRouter>;

async function render() {
  onFinished = vi.fn<(outcome: SignatureOutcome) => void>();
  onCancel = vi.fn<() => void>();
  // A data router: `useBlocker` only exists inside one, and the block is the
  // point of this component.
  router = createMemoryRouter(
    [{
      path: '/supervisor/dashboard',
      element: <TmSignatureHandoff ticket={TICKET} onFinished={onFinished} onCancel={onCancel} />,
    }, {
      path: '/elsewhere',
      element: <div data-testid="elsewhere" />,
    }],
    { initialEntries: ['/supervisor/dashboard'] },
  );
  await act(async () => { root.render(<RouterProvider router={router} />); });
  await act(async () => { await Promise.resolve(); });
}

function byText(text: string): HTMLElement | undefined {
  return Array.from(container.querySelectorAll('button, h2, p, dd, td, span'))
    .find(el => el.textContent?.trim() === text) as HTMLElement | undefined;
}

async function click(el: Element | undefined) {
  if (!el) throw new Error('element not found');
  await act(async () => { (el as HTMLElement).click(); });
  await act(async () => { await Promise.resolve(); });
}

function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function startSigning() {
  await click(byText(i18n.t('tm:handoff.start')));
}

beforeEach(async () => {
  await i18n.changeLanguage('es');
  svc.openSignatureSession.mockReset().mockResolvedValue(SESSION);
  svc.submitSignature.mockReset().mockResolvedValue({
    status: 'SIGNED',
    signedAt: '2026-08-11T16:00:00Z',
    signerName: 'Carlos Méndez',
    signerTitle: 'Supervisor de obra',
    documentHash: 'b'.repeat(64),
  });
  svc.declineSignature.mockReset().mockResolvedValue({
    status: 'DECLINED',
    signedAt: null,
    signerName: null,
    signerTitle: null,
    documentHash: 'b'.repeat(64),
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
});

describe('before the device changes hands', () => {
  it('shows the ticket and does not open a signing session yet', async () => {
    await render();

    expect(container.textContent).toContain('TM-000042');
    expect(container.textContent).toContain('Torre Norte');
    expect(svc.openSignatureSession).not.toHaveBeenCalled();
    // The document is not on screen until the encargado hands it over.
    expect(container.querySelector('table')).toBeNull();
  });

  it('backs out without touching the ticket', async () => {
    await render();
    await click(byText(i18n.t('tm:handoff.cancel')));

    expect(onCancel).toHaveBeenCalled();
    expect(svc.openSignatureSession).not.toHaveBeenCalled();
  });
});

describe('once the supervisor has the device', () => {
  it('opens the session with the token from the signUrl, not the whole URL', async () => {
    await render();
    await startSigning();

    expect(svc.openSignatureSession).toHaveBeenCalledWith('link-token-123');
  });

  it('renders the frozen document as a T&M sheet, not as an invoice', async () => {
    await render();
    await startSigning();

    expect(container.textContent).toContain(i18n.t('signatures:kind.timeAndMaterial'));
    expect(container.textContent).not.toContain(i18n.t('signatures:kind.invoice'));
    expect(container.textContent).toContain('$575.50');
  });

  it('omits the due-date row a T&M sheet does not have', async () => {
    await render();
    await startSigning();

    expect(container.textContent).not.toContain(i18n.t('signatures:doc.due'));
  });

  it('requires the signature AND the name AND the title', async () => {
    await render();
    await startSigning();

    const submit = byText(i18n.t('signatures:form.submit')) as HTMLButtonElement;
    const [nameInput, titleInput] = Array.from(
      container.querySelectorAll('input[type="text"]'),
    ) as HTMLInputElement[];

    expect(submit.disabled).toBe(true);

    await act(async () => { typeInto(nameInput, 'Carlos Méndez'); });
    expect((byText(i18n.t('signatures:form.submit')) as HTMLButtonElement).disabled).toBe(true);

    await act(async () => { typeInto(titleInput, 'Supervisor de obra'); });
    // Name + title but no ink is still not a signature.
    expect((byText(i18n.t('signatures:form.submit')) as HTMLButtonElement).disabled).toBe(true);

    await click(container.querySelector('[data-testid="fake-pad"]')!);
    expect((byText(i18n.t('signatures:form.submit')) as HTMLButtonElement).disabled).toBe(false);
  });

  it('signs with the session bearer token and all three fields', async () => {
    await render();
    await startSigning();

    const [nameInput, titleInput] = Array.from(
      container.querySelectorAll('input[type="text"]'),
    ) as HTMLInputElement[];
    await act(async () => { typeInto(nameInput, 'Carlos Méndez'); });
    await act(async () => { typeInto(titleInput, 'Supervisor de obra'); });
    await click(container.querySelector('[data-testid="fake-pad"]')!);
    await click(byText(i18n.t('signatures:form.submit')));

    expect(svc.submitSignature).toHaveBeenCalledWith('signing-session-1', {
      signerName: 'Carlos Méndez',
      signerTitle: 'Supervisor de obra',
      signatureImage: 'data:image/png;base64,AAAA',
    });
  });

  it('records a refusal without a signature', async () => {
    await render();
    await startSigning();
    await click(byText(i18n.t('signatures:form.decline')));

    expect(svc.declineSignature).toHaveBeenCalledWith('signing-session-1');
    expect(container.textContent).toContain(i18n.t('tm:handoff.declinedBody'));
  });

  it('refuses to navigate away while a stranger holds the phone', async () => {
    await render();
    await startSigning();

    await act(async () => { void router.navigate('/elsewhere'); });
    await act(async () => { await Promise.resolve(); });

    // Still on the signing screen, and the panel underneath was never reached.
    expect(container.querySelector('[data-testid="elsewhere"]')).toBeNull();
    expect(router.state.location.pathname).toBe('/supervisor/dashboard');
  });
});

describe('handing the device back', () => {
  it('reports the outcome and lets the encargado carry on', async () => {
    await render();
    await startSigning();

    const [nameInput, titleInput] = Array.from(
      container.querySelectorAll('input[type="text"]'),
    ) as HTMLInputElement[];
    await act(async () => { typeInto(nameInput, 'Carlos Méndez'); });
    await act(async () => { typeInto(titleInput, 'Supervisor de obra'); });
    await click(container.querySelector('[data-testid="fake-pad"]')!);
    await click(byText(i18n.t('signatures:form.submit')));

    expect(container.textContent).toContain(i18n.t('tm:handoff.signedBody'));

    await click(byText(i18n.t('tm:handoff.return')));

    expect(onFinished).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'SIGNED', signerName: 'Carlos Méndez' }),
    );
    // The session was never navigated away from: the encargado is still here.
    expect(router.state.location.pathname).toBe('/supervisor/dashboard');
  });
});

describe('when the link is already dead', () => {
  it('says so instead of showing a blank pad', async () => {
    svc.openSignatureSession.mockRejectedValueOnce(new Error('gone'));
    await render();
    await startSigning();

    expect(container.textContent).toContain(i18n.t('tm:handoff.failedTitle'));
    expect(container.querySelector('[data-testid="fake-pad"]')).toBeNull();
  });
});
