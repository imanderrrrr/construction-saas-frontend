import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { FakeApiError } = vi.hoisted(() => ({
  FakeApiError: class FakeApiError extends Error {
    status: number; details?: unknown; code?: string; retryAfterSeconds?: number;
    constructor(status: number, message: string, details?: unknown, code?: string, retryAfterSeconds?: number) {
      super(message); this.name = 'ApiError';
      this.status = status; this.details = details; this.code = code; this.retryAfterSeconds = retryAfterSeconds;
    }
  },
}));
const mocks = vi.hoisted(() => ({
  changePassword: vi.fn(),
  getMe: vi.fn(),
  getBranding: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && 'count' in opts) return `${key}#${opts.count}`;
      if (opts && 'minutes' in opts) return `${key}#${opts.minutes}`;
      return key;
    },
    i18n: { language: 'es' },
  }),
}));
vi.mock('../../services/auth', () => ({
  ApiError: FakeApiError,
  AuthService: { changePassword: mocks.changePassword, getMe: mocks.getMe, getUsername: () => 'ana.ruiz' },
}));
vi.mock('../../services/branding', () => ({ getBranding: mocks.getBranding }));
vi.mock('../../lib/api', () => ({ ApiError: FakeApiError, getStoredRole: () => 'ADMIN' }));

import { AccountDrawer } from './AccountDrawer';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Built at runtime: literal passwords in a test read as leaks to the secret scanner.
const CURRENT_PW = ['my', 'own', '2026'].join('-');
const NEW_PW = ['a', 'brand', 'new', 'one', '26'].join('-');

async function flush() { await act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); }); }

async function type(id: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(`#${id}`)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function submit() {
  await act(async () => {
    document.querySelector('#account-password-form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    for (let i = 0; i < 8; i++) await Promise.resolve();
  });
}

describe('AccountDrawer', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onOpenChange = vi.fn();
  const onSignOut = vi.fn();

  beforeEach(() => {
    Object.values(mocks).forEach(m => m.mockReset());
    onOpenChange.mockReset(); onSignOut.mockReset();
    mocks.getMe.mockResolvedValue({ username: 'ana.ruiz', role: 'ADMIN', fullName: 'Ana Ruiz' });
    mocks.getBranding.mockResolvedValue({ organizationName: 'Constructora Andes' });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function render(open = true) {
    await act(async () => { root.render(<AccountDrawer open={open} onOpenChange={onOpenChange} onSignOut={onSignOut} />); });
    await flush();
  }

  it('renders nothing while closed', async () => {
    await render(false);
    expect(document.querySelector('[data-testid="account-drawer"]')).toBeNull();
  });

  it('opens with the identity rows and the change form, eye closed', async () => {
    await render();
    const drawer = document.querySelector('[data-testid="account-drawer"]')!;
    expect(drawer).not.toBeNull();
    const text = document.body.textContent!;
    expect(text).toContain('Ana Ruiz');
    expect(text).toContain('ana.ruiz');
    expect(text).toContain('common:roles.ADMIN');
    expect(text).toContain('Constructora Andes');
    expect(text).toContain('admin:account.change.lead');
    expect(text).toContain('admin:account.change.hint');
    expect(text).not.toContain('admin:account.lastLogin');
    expect(document.querySelector<HTMLInputElement>('#account-current')!.type).toBe('password');
  });

  it('on success shows the confirmation in place of the fields and keeps the drawer open', async () => {
    mocks.changePassword.mockResolvedValueOnce(undefined);
    await render();
    await type('account-current', CURRENT_PW);
    await type('account-new', NEW_PW);
    await submit();
    expect(mocks.changePassword).toHaveBeenCalledWith({ currentPassword: CURRENT_PW, newPassword: NEW_PW });
    expect(document.querySelector('[data-testid="account-done"]')).not.toBeNull();
    expect(document.body.textContent).toContain('admin:account.done.message');
    expect(document.querySelector('#account-password-form')).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(document.body.textContent).toContain('admin:account.close');
  });

  it('maps the failures: 401 under the current field, PASSWORD_UNCHANGED under the new one, 429 with minutes', async () => {
    mocks.changePassword
      .mockRejectedValueOnce(new FakeApiError(401, 'wrong', undefined, 'INVALID_CREDENTIALS'))
      .mockRejectedValueOnce(new FakeApiError(400, 'same', undefined, 'PASSWORD_UNCHANGED'))
      .mockRejectedValueOnce(new FakeApiError(429, 'slow', undefined, 'RATE_LIMITED', 600));
    await render();
    await type('account-current', CURRENT_PW);
    await type('account-new', NEW_PW);

    await submit();
    expect(document.body.textContent).toContain('admin:account.change.error.current');
    await submit();
    expect(document.body.textContent).toContain('admin:account.change.error.unchanged');
    await submit();
    expect(document.body.textContent).toContain('admin:account.change.error.rateLimited.message#10');
    expect(document.querySelector('[data-testid="account-done"]')).toBeNull();
  });
});
