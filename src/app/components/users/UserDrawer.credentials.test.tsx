// BuildTrack — re-downloading a field worker's credential sheet.
//
// The PIN is stored as a BCrypt hash and nothing can read it back, so the
// drawer offers two explicit modes and the admin picks one BEFORE anything
// happens: re-print the QR + identifier (nothing changes server-side), or
// reset the PIN through the existing hashed endpoint and print the new one.
//
// These tests pin that contract: the plain sheet never touches the PIN, the
// reset sheet prints exactly the PIN the backend confirmed it stored, the
// warning about the old PIN is on screen before the click, and a failed reset
// downloads nothing.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getWorkerQr: vi.fn(),
  setWorkerPin: vi.fn(),
  download: vi.fn(),
}));

// Same shape as the other users/ component tests: the import graph reaches
// src/i18n, whose init needs initReactI18next to exist.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es-GT', exists: () => false },
  }),
  Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('../../services/users', () => ({
  getWorkerQr: mocks.getWorkerQr,
  setWorkerPin: mocks.setWorkerPin,
  regenerateWorkerQr: vi.fn(),
  resetPassword: vi.fn(),
  updateUser: vi.fn(),
  revokeSession: vi.fn(),
  revokeAllSessions: vi.fn(),
  listUserSessions: vi.fn(() => Promise.resolve([])),
  listUserActivity: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../services/invoiceBranding', () => ({
  loadInvoiceIssuer: vi.fn(() => Promise.resolve(undefined)),
}));

vi.mock('../../helpers/exportCredentialPdf', () => ({
  downloadCredentialPdf: mocks.download,
  credentialPdfLabels: vi.fn(() => ({})),
}));

vi.mock('qrcode', () => ({ default: { toCanvas: vi.fn(() => Promise.resolve()) } }));

import { UserDrawer } from './UserDrawer';
import type { UserDTO } from '../../services/users';

const WORKER: UserDTO = {
  id: 42, username: 'pedro.obrero', fullName: 'Pedro Obrero',
  role: 'WORKER', status: 'ACTIVE', updatedAt: '2026-09-01T00:00:00Z', hourlyRate: null,
};
const QR = { qrToken: 'tok-abc', username: 'pedro.obrero', tenant: 'vista-del-mar', hasPin: true };

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.getWorkerQr.mockReset();
  mocks.setWorkerPin.mockReset();
  mocks.download.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const text = () => container.textContent || '';

function buttonByText(needle: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')]
    .find(b => (b.textContent || '').includes(needle));
  if (!found) throw new Error(`no button containing "${needle}"`);
  return found as HTMLButtonElement;
}

function radioByText(needle: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('[role="radio"]')]
    .find(b => (b.textContent || '').includes(needle));
  if (!found) throw new Error(`no radio containing "${needle}"`);
  return found as HTMLButtonElement;
}

/** The confirm button of the sheet panel: the one whose label is one of the two modes. */
const confirmButton = () =>
  [...container.querySelectorAll('button')].find(b =>
    /admin:usr\.d\.dl\.go(Reset)?$/.test((b.textContent || '').trim()))!;

const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

/** Mounts the drawer for a field worker and opens the download panel. */
async function openPanel(qr = QR) {
  mocks.getWorkerQr.mockResolvedValue(qr);
  await act(async () => {
    root.render(<UserDrawer user={WORKER} onClose={() => {}} onChanged={() => {}} />);
  });
  await settle();
  await act(async () => buttonByText('admin:usr.d.download').click());
}

describe('user drawer · download credentials', () => {
  it('offers both modes, with the old-PIN warning on screen before anything happens', async () => {
    await openPanel();

    expect(text()).toContain('admin:usr.d.dl.plain');
    expect(text()).toContain('admin:usr.d.dl.reset');
    expect(text()).toContain('admin:usr.d.dl.resetWarn');
    expect(text()).toContain('admin:usr.d.dl.sensitive');
    // Plain is the default for a worker who already has a PIN…
    expect(radioByText('admin:usr.d.dl.plain').getAttribute('aria-checked')).toBe('true');
    // …and the confirm label says so.
    expect((confirmButton().textContent || '').trim()).toBe('admin:usr.d.dl.go');
    expect(mocks.setWorkerPin).not.toHaveBeenCalled();
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it('plain sheet: QR + identifier, and the PIN is never touched', async () => {
    await openPanel();

    await act(async () => confirmButton().click());
    await settle();

    expect(mocks.setWorkerPin).not.toHaveBeenCalled();
    expect(mocks.download).toHaveBeenCalledTimes(1);
    const data = mocks.download.mock.calls[0][0];
    expect(data.secret).toEqual({ kind: 'pinUnavailable' });
    expect(data.qrToken).toBe('tok-abc');
    expect(data.workspaceSlug).toBe('vista-del-mar');
    expect(data.username).toBe('pedro.obrero');
  });

  it('reset sheet: the label changes, the PIN is stored first, and the sheet prints that same PIN', async () => {
    mocks.setWorkerPin.mockResolvedValue(undefined);
    await openPanel();

    await act(async () => radioByText('admin:usr.d.dl.reset').click());
    expect((confirmButton().textContent || '').trim()).toBe('admin:usr.d.dl.goReset');

    await act(async () => confirmButton().click());
    await settle();

    expect(mocks.setWorkerPin).toHaveBeenCalledTimes(1);
    const [userId, pin] = mocks.setWorkerPin.mock.calls[0];
    expect(userId).toBe(42);
    expect(pin).toMatch(/^\d{6}$/);

    expect(mocks.download).toHaveBeenCalledTimes(1);
    expect(mocks.download.mock.calls[0][0].secret).toEqual({ kind: 'pin', value: pin, replaced: true });
    // Stored before printed: a sheet never carries a PIN the backend did not confirm.
    expect(mocks.setWorkerPin.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.download.mock.invocationCallOrder[0]);
  });

  it('a failed reset downloads nothing and says the previous PIN still works', async () => {
    mocks.setWorkerPin.mockRejectedValue(new Error('500'));
    await openPanel();

    await act(async () => radioByText('admin:usr.d.dl.reset').click());
    await act(async () => confirmButton().click());
    await settle();

    expect(mocks.download).not.toHaveBeenCalled();
    expect(text()).toContain('admin:usr.d.dl.resetError');
  });

  it('legacy default tenant: the sheet gets no identifier to type', async () => {
    await openPanel({ ...QR, tenant: 'default' });

    await act(async () => confirmButton().click());
    await settle();

    expect(mocks.download.mock.calls[0][0].workspaceSlug).toBeNull();
  });

  it('a worker without a PIN starts on the reset mode, and is told why', async () => {
    await openPanel({ ...QR, hasPin: false });

    expect(radioByText('admin:usr.d.dl.reset').getAttribute('aria-checked')).toBe('true');
    expect(text()).toContain('admin:usr.d.dl.noPinHint');
    expect((confirmButton().textContent || '').trim()).toBe('admin:usr.d.dl.goReset');
  });
});
