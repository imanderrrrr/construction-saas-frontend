import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../../i18n';
import { SignatureDocumentView } from './SignatureDocumentView';
import { signatureEvidenceUrl, type SignatureDocument } from '../../services/signatures';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const doc: SignatureDocument = {
  documentKind: 'TIME_AND_MATERIAL', documentNumber: 'TM-0001', companyName: 'Builder',
  clientName: 'Client', projectName: 'Tower', description: null, dueDate: "", notes: null, issuedDate: '2026-10-07',
  lineItems: [], subtotalCents: 1000, discountCents: 0, taxRate: '0', taxCents: 0,
  totalCents: 1000, currency: 'USD', documentHash: 'a'.repeat(64), expiresAt: '2026-10-08T12:00:00Z',
  photos: [{ id: 42, url: '/api/v1/sign/photos/42', fileName: 'Evidence.png', byteSize: 70, createdAt: '2026-10-07T12:00:00Z' }],
};

describe('frozen signature evidence', () => {
  let container: HTMLDivElement;
  let root: Root;
  const fetchPhoto = vi.fn();
  const revoke = vi.fn();
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    fetchPhoto.mockReset().mockResolvedValue({ ok: true, blob: async () => new Blob(['image'], { type: 'image/png' }) });
    revoke.mockReset();
    vi.stubGlobal('fetch', fetchPhoto);
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = vi.fn(() => 'blob:evidence');
      static revokeObjectURL = revoke;
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });
  async function render(sessionToken?: string) {
    await act(async () => root.render(<SignatureDocumentView doc={doc} sessionToken={sessionToken} />));
    await act(async () => { await Promise.resolve(); });
  }
  it('loads evidence using signing session authorization', async () => {
    await render('session-only');
    expect(fetchPhoto).toHaveBeenCalledWith(signatureEvidenceUrl(42), expect.objectContaining({
      headers: { Authorization: 'Bearer session-only' },
    }));
    expect(container.querySelector('img')?.alt).toBe('Evidence.png');
  });
  it('requires a signature session before fetching protected photos', async () => {
    await render();
    expect(fetchPhoto).not.toHaveBeenCalled();
    expect(container.querySelector('img')).toBeNull();
  });
  it('opens the same frozen evidence in a dialog and releases blobs on cleanup', async () => {
    await render('session-only');
    await act(async () => (container.querySelector('button') as HTMLButtonElement).click());
    await act(async () => { await Promise.resolve(); });
    expect(document.querySelector('[role="dialog"] img')?.getAttribute('alt')).toBe('Evidence.png');
    expect(fetchPhoto).toHaveBeenCalledTimes(2);
    await act(async () => root.render(<div />));
    expect(revoke).toHaveBeenCalledTimes(2);
  });
});
