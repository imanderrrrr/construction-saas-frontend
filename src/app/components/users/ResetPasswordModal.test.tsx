import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resetPassword: vi.fn(),
  download: vi.fn(),
  labels: vi.fn(() => ({})),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts && 'name' in opts ? `${key}#${opts.name}` : key),
    i18n: { language: 'es' },
  }),
}));
vi.mock('../../services/users', () => ({ resetPassword: mocks.resetPassword }));
vi.mock('../../services/invoiceBranding', () => ({ loadInvoiceIssuer: vi.fn(() => Promise.resolve(undefined)) }));
vi.mock('../../helpers/exportCredentialPdf', () => ({ downloadCredentialPdf: mocks.download, credentialPdfLabels: mocks.labels }));
vi.mock('../../lib/api', () => ({ getStoredTenantSlug: () => 'constructora-andes' }));

import { ResetPasswordModal } from './ResetPasswordModal';
import type { UserDTO } from '../../services/users';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const kevin = { id: 7, username: 'kperez', fullName: 'Kevin Pérez', role: 'FINANCE', status: 'ACTIVE' } as unknown as UserDTO;
const PASSWORD_SHAPE = /^[A-HJ-NP-Za-kmnp-z2-9]{4}-[A-HJ-NP-Za-kmnp-z2-9]{4}$/;

const shown = () => document.querySelector('[data-testid="temp-password"]')!.textContent!;
const button = (label: string) => Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes(label))!;
async function flush() { await act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); }); }

describe('ResetPasswordModal', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onOpenChange = vi.fn();
  const onReset = vi.fn();
  const writeText = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    Object.values(mocks).forEach(m => m.mockReset());
    mocks.labels.mockReturnValue({});
    onOpenChange.mockReset(); onReset.mockReset(); writeText.mockClear();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function render() {
    await act(async () => { root.render(<ResetPasswordModal open onOpenChange={onOpenChange} user={kevin} onReset={onReset} />); });
    await flush();
  }

  it('generates a XXXX-XXXX password without ambiguous letters, names the person, and regenerates on demand', async () => {
    await render();
    const first = shown();
    expect(first).toMatch(PASSWORD_SHAPE);
    expect(document.body.textContent).toContain('admin:usr.d.reset.title#Kevin');
    expect(document.body.textContent).toContain('admin:usr.d.reset.note');
    expect(document.body.textContent).toContain('admin:usr.d.reset.format');
    await act(async () => { button('admin:usr.d.reset.regenerate').click(); });
    expect(shown()).toMatch(PASSWORD_SHAPE);
    expect(shown()).not.toBe(first);
  });

  it('resets with the password on screen and then shows it once more with the download', async () => {
    mocks.resetPassword.mockResolvedValueOnce(undefined);
    await render();
    const value = shown();
    await act(async () => { button('admin:usr.d.reset.confirm').click(); await Promise.resolve(); });
    await flush();
    expect(mocks.resetPassword).toHaveBeenCalledWith(7, { newPassword: value });
    expect(document.querySelector('[data-testid="reset-password-modal"]')!.getAttribute('data-stage')).toBe('done');
    expect(document.body.textContent).toContain('admin:usr.d.reset.done.title');
    expect(document.body.textContent).toContain('kperez');
    expect(shown()).toBe(value);
    expect(onReset).toHaveBeenCalled();

    await act(async () => { button('admin:usr.d.reset.done.download').click(); });
    await flush();
    expect(mocks.labels).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ access: 'OFFICE' }));
    expect(mocks.download).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'kperez', workspaceSlug: 'constructora-andes', qrToken: null, secret: { kind: 'password', value } }),
      expect.anything(),
      undefined,
    );
  });

  it('a failed reset keeps the same password for the retry', async () => {
    mocks.resetPassword.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(undefined);
    await render();
    const value = shown();
    await act(async () => { button('admin:usr.d.reset.confirm').click(); await Promise.resolve(); });
    await flush();
    expect(document.body.textContent).toContain('admin:usr.d.reset.error.message#Kevin');
    expect(shown()).toBe(value);
    await act(async () => { button('admin:usr.d.reset.retry').click(); await Promise.resolve(); });
    await flush();
    expect(mocks.resetPassword).toHaveBeenLastCalledWith(7, { newPassword: value });
    expect(document.querySelector('[data-testid="reset-password-modal"]')!.getAttribute('data-stage')).toBe('done');
  });

  it('copies the password to the clipboard', async () => {
    await render();
    await act(async () => { button('admin:usr.d.reset.copy').click(); await Promise.resolve(); });
    expect(writeText).toHaveBeenCalledWith(shown());
    expect(document.body.textContent).toContain('admin:usr.d.reset.copied');
  });
});
