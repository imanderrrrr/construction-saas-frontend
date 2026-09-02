// BuildTrack — the first hand-over downloads the same credential sheet the
// user drawer re-downloads later, instead of window.print() over the whole
// page. It is the ONE sheet that carries the PIN: the PIN was just typed
// here, so this is the only moment it is known in the clear.
//
// The test walks the wizard the way an admin does and checks the sheet gets
// exactly the credential that was sent to the backend.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createUser: vi.fn(),
  setWorkerPin: vi.fn(),
  getWorkerQr: vi.fn(),
  getStoredTenantSlug: vi.fn(),
  download: vi.fn(),
  labels: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es-GT' } }),
  Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('../../services/users', () => ({
  createUser: mocks.createUser,
  getWorkerQr: mocks.getWorkerQr,
  setWorkerPin: mocks.setWorkerPin,
}));

vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  getStoredTenantSlug: mocks.getStoredTenantSlug,
}));

vi.mock('../../services/invoiceBranding', () => ({
  loadInvoiceIssuer: vi.fn(() => Promise.resolve(undefined)),
}));

vi.mock('../../helpers/exportCredentialPdf', () => ({
  downloadCredentialPdf: mocks.download,
  credentialPdfLabels: mocks.labels,
}));

vi.mock('qrcode', () => ({ default: { toCanvas: vi.fn(() => Promise.resolve()) } }));

import { NewUserFlow } from './NewUserFlow';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.createUser.mockReset();
  mocks.setWorkerPin.mockReset().mockResolvedValue(undefined);
  mocks.getWorkerQr.mockReset().mockResolvedValue({
    qrToken: 'tok-abc', username: 'pedro.obrero', tenant: 'vista-del-mar', hasPin: true,
  });
  mocks.getStoredTenantSlug.mockReset().mockReturnValue('vista-del-mar');
  mocks.download.mockReset();
  mocks.labels.mockReset().mockImplementation((_t, opts) => ({ access: opts.access }));
  window.print = vi.fn();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value',
  )!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function buttonByText(needle: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')]
    .find(b => (b.textContent || '').includes(needle));
  if (!found) throw new Error(`no button containing "${needle}"`);
  return found as HTMLButtonElement;
}

const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

async function mount(name: string) {
  await act(async () => {
    root.render(<NewUserFlow existingUsernames={[]} onClose={() => {}} onCreated={() => {}} />);
  });
  const nameInput = container.querySelector('input') as HTMLInputElement;
  await act(async () => typeInto(nameInput, name));
}

describe('new-user hand-over sheet', () => {
  it('field worker: the sheet carries the PIN just set and the QR, and nothing is printed', async () => {
    await mount('Pedro Obrero');
    // WORKER is the default role: QR + PIN.
    await act(async () => buttonByText('admin:usr.new.next').click());

    const pinInput = container.querySelector('input[inputmode="numeric"]') as HTMLInputElement;
    await act(async () => typeInto(pinInput, '482913'));

    mocks.createUser.mockResolvedValue({
      id: 9, username: 'pedro.obrero', fullName: 'Pedro Obrero',
      role: 'WORKER', status: 'ACTIVE', hourlyRate: null, updatedAt: '2026-09-02T00:00:00Z',
    });
    await act(async () => buttonByText('admin:usr.new.create').click());
    await settle();

    // The PIN that was hashed is the PIN that goes on paper.
    expect(mocks.setWorkerPin).toHaveBeenCalledWith(9, '482913');

    await act(async () => buttonByText('admin:usr.new.print').click());
    await settle();

    expect(window.print).not.toHaveBeenCalled();
    expect(mocks.download).toHaveBeenCalledTimes(1);
    const [data, labels] = mocks.download.mock.calls[0];
    expect(data).toMatchObject({
      username: 'pedro.obrero',
      fullName: 'Pedro Obrero',
      workspaceSlug: 'vista-del-mar',
      qrToken: 'tok-abc',
      secret: { kind: 'pin', value: '482913', replaced: false },
    });
    expect(labels).toEqual({ access: 'FIELD' });
  });

  it('office user: the sheet carries the temporary password shown on screen, no QR', async () => {
    await mount('Carlos Contador');
    await act(async () => buttonByText('common:roles.FINANCE').click());
    await act(async () => buttonByText('admin:usr.new.next').click());

    const shown = [...container.querySelectorAll('span.font-bt-mono')]
      .map(el => (el.textContent || '').trim())
      .find(s => /^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/.test(s));
    expect(shown, 'temp password not on the access step').toBeTruthy();

    mocks.createUser.mockResolvedValue({
      id: 7, username: 'carlos.contador', fullName: 'Carlos Contador',
      role: 'FINANCE', status: 'ACTIVE', hourlyRate: null, updatedAt: '2026-09-02T00:00:00Z',
    });
    await act(async () => buttonByText('admin:usr.new.create').click());
    await settle();

    await act(async () => buttonByText('admin:usr.new.print').click());
    await settle();

    expect(mocks.setWorkerPin).not.toHaveBeenCalled();
    const [data, labels] = mocks.download.mock.calls[0];
    expect(data).toMatchObject({
      username: 'carlos.contador',
      qrToken: null,
      secret: { kind: 'password', value: shown },
    });
    expect(data.secret.value).toBe(mocks.createUser.mock.calls[0][0].password);
    expect(labels).toEqual({ access: 'OFFICE' });
  });
});
