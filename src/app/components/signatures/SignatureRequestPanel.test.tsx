// BuildTrack — the panel's "this document changed" warning.
//
// The backend sets `documentChanged` when the live invoice no longer matches
// the snapshot that was frozen and sent. The product decision was to REPORT,
// not block: the pending link must stay usable and the signer keeps signing
// the frozen version. So these tests check both halves — that the warning
// appears, and that nothing else about the panel is taken away when it does.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({
  getSignatureRequest: vi.fn(),
  requestSignature: vi.fn(),
  revokeSignatureRequest: vi.fn(),
}));

vi.mock('../../services/signatures', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/signatures')>();
  return {
    ...actual,
    getSignatureRequest: svc.getSignatureRequest,
    requestSignature: svc.requestSignature,
    revokeSignatureRequest: svc.revokeSignatureRequest,
  };
});

import i18n from '../../../i18n';
import { SignatureRequestPanel } from './SignatureRequestPanel';
import type { SignatureRequestState } from '../../services/signatures';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const PENDING: SignatureRequestState = {
  id: 3,
  status: 'PENDING',
  version: 1,
  signToken: 'link-token',
  signUrl: 'https://app.example/sign/link-token',
  expiresAt: '2026-08-22T00:00:00Z',
  documentHash: 'a'.repeat(64),
  recipientEmail: 'super@cliente.com',
  recipientName: 'Carlos',
  requestedBy: 'finanzas',
  requestedAt: '2026-08-09T00:00:00Z',
  emailSent: true,
  signerName: null,
  signerTitle: null,
  signedAt: null,
  signerIp: null,
  hasSignatureImage: false,
  declinedAt: null,
  declineReason: null,
  revokedAt: null,
  documentChanged: false,
};

describe('SignatureRequestPanel — document-changed warning', () => {
  let container: HTMLDivElement;
  let root: Root;

  async function render(state: SignatureRequestState) {
    svc.getSignatureRequest.mockResolvedValue(state);
    await act(async () => {
      root.render(<SignatureRequestPanel receivableId={42} />);
    });
    await act(async () => { await Promise.resolve(); });
  }

  beforeEach(async () => {
    await i18n.changeLanguage('es');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    svc.getSignatureRequest.mockReset();
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
  });

  it('says nothing while the document still matches what was sent', async () => {
    await render(PENDING);
    expect(container.textContent).not.toContain('cambió después de mandar el enlace');
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('warns when the invoice changed after the link went out', async () => {
    await render({ ...PENDING, documentChanged: true });

    const warning = container.querySelector('[role="status"]');
    expect(warning).not.toBeNull();
    expect(warning!.textContent).toContain('cambió después de mandar el enlace');
    // The warning has to say what to DO about it, not just that something is off.
    expect(warning!.textContent).toContain('pida la firma otra vez');
  });

  it('warns without disabling anything — reporting is not invalidating', async () => {
    // The product decision, as a test. If this ever starts hiding the copy
    // button or the pending state, the warning has quietly become a block.
    await render({ ...PENDING, documentChanged: true });

    const buttons = [...container.querySelectorAll('button')];
    const copy = buttons.find((b) => /copiar|copy/i.test(b.textContent ?? ''));
    expect(copy, 'the copy-link button must survive the warning').toBeTruthy();
    expect(copy!.disabled).toBe(false);
  });
});
