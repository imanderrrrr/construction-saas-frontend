import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Second warehouse audit (2026-10-28): CreateUserRequest takes a full name of
// at most 25 and a username of at most 30. The only web screen that creates
// users capped neither, and derived the username from the uncapped name, so a
// long name came back as a 400 on both fields.

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es-GT' } }),
  Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('../../services/users', () => ({ createUser: vi.fn(), getWorkerQr: vi.fn(), setWorkerPin: vi.fn() }));
vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  getStoredTenantSlug: vi.fn(() => 'vista-del-mar'),
}));
vi.mock('../../services/invoiceBranding', () => ({ loadInvoiceIssuer: vi.fn(() => Promise.resolve(undefined)) }));
vi.mock('../../helpers/exportCredentialPdf', () => ({ downloadCredentialPdf: vi.fn(), credentialPdfLabels: vi.fn() }));
vi.mock('qrcode', () => ({ default: { toCanvas: vi.fn(() => Promise.resolve()) } }));

import { NewUserFlow } from './NewUserFlow';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function typeInto(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('NewUserFlow — identity fields stay within CreateUserRequest', () => {
  it('caps the full name at 25 and the username at 30', async () => {
    await act(async () => {
      root.render(<NewUserFlow existingUsernames={[]} onClose={() => {}} onCreated={() => {}} />);
    });
    const [name, username] = [...container.querySelectorAll('input')] as HTMLInputElement[];
    expect(name.maxLength).toBe(25);
    expect(username.maxLength).toBe(30);
  });

  it('derives a username of at most 30 from a long name', async () => {
    await act(async () => {
      root.render(<NewUserFlow existingUsernames={[]} onClose={() => {}} onCreated={() => {}} />);
    });
    const [name, username] = [...container.querySelectorAll('input')] as HTMLInputElement[];
    // The browser's maxLength stops typing, not a value set by script or paste-like input.
    await act(async () => typeInto(name, 'María Fernanda Castañeda Villagrán de León'));

    expect(username.value.length).toBeLessThanOrEqual(30);
    expect(username.value).toMatch(/^maria\.fernanda\.castaneda/);
    expect(username.value.endsWith('.')).toBe(false);
  });
});
