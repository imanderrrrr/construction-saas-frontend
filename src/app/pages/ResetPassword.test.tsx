import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock factories are hoisted above every import, so anything they
// reference has to be hoisted with them.
const { FakeApiError } = vi.hoisted(() => ({
  FakeApiError: class FakeApiError extends Error {
    status: number; details?: unknown; code?: string; retryAfterSeconds?: number;
    constructor(status: number, message: string, details?: unknown, code?: string, retryAfterSeconds?: number) {
      super(message);
      this.name = 'ApiError';
      this.status = status; this.details = details; this.code = code; this.retryAfterSeconds = retryAfterSeconds;
    }
  },
}));

const mocks = vi.hoisted(() => ({
  preview: vi.fn(),
  confirm: vi.fn(),
  navigate: vi.fn(),
  startWelcome: vi.fn(),
  setWelcomeCompany: vi.fn(),
  setPasswordChangeRequired: vi.fn(),
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

vi.mock('react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useNavigate: () => mocks.navigate,
  useParams: () => ({ token: 'tok-123' }),
}));

vi.mock('../lib/api', () => ({ ApiError: FakeApiError, getStoredTenantSlug: () => '' }));
vi.mock('../services/auth', () => ({
  ApiError: FakeApiError,
  AuthService: { getDashboardRoute: (role: string) => `/${role.toLowerCase()}/dashboard` },
}));
vi.mock('../services/passwordReset', () => ({
  PasswordResetService: { preview: mocks.preview, confirm: mocks.confirm },
}));
vi.mock('../lib/welcome', () => ({ startWelcome: mocks.startWelcome, setWelcomeCompany: mocks.setWelcomeCompany }));
vi.mock('../lib/passwordChangeState', () => ({ setPasswordChangeRequired: mocks.setPasswordChangeRequired }));
vi.mock('../components/LanguageSwitcher', () => ({ LanguageSwitcher: () => <span data-testid="language-switcher" /> }));

import { ResetPassword, DONE_MS } from './ResetPassword';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const RESET_PREVIEW = { intent: 'RESET', username: 'ana.ruiz', fullName: 'Ana Ruiz', tenantName: 'Constructora Andes', tenantSlug: 'constructora-andes', expiresAt: '2099-01-01T00:00:00Z' };
const SESSION = { accessToken: '', refreshToken: '', role: 'ADMIN', username: 'ana.ruiz', fullName: 'Ana Ruiz', expiresIn: 1, expiresInMinutes: 480 };

async function flush() { await act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); }); }

async function typePassword(container: HTMLElement, value: string) {
  const input = container.querySelector<HTMLInputElement>('#newPassword')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function submit(container: HTMLElement) {
  await act(async () => {
    container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    for (let i = 0; i < 8; i++) await Promise.resolve();
  });
}

describe('ResetPassword', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.values(mocks).forEach(m => m.mockReset());
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  async function render() {
    await act(async () => { root.render(<ResetPassword />); });
    await flush();
  }

  it('opens with the account the preflight answered, in the RESET wording, eye closed', async () => {
    mocks.preview.mockResolvedValueOnce(RESET_PREVIEW);
    await render();
    const text = container.textContent!;
    expect(mocks.preview).toHaveBeenCalledWith('tok-123');
    expect(text).toContain('resetPassword.title');
    expect(text).toContain('resetPassword.kicker');
    expect(text).toContain('ana.ruiz');
    expect(text).toContain('Constructora Andes');
    expect(text).toContain('AR');
    expect(text).toContain('resetPassword.newPassword.hint');
    expect(text).toContain('resetPassword.singleUseSeal');
    expect(container.querySelector<HTMLInputElement>('#newPassword')!.type).toBe('password');
    expect(container.querySelector('[data-testid="reset-verifying"]')).toBeNull();
  });

  it('a SETUP link speaks of a first password', async () => {
    mocks.preview.mockResolvedValueOnce({ ...RESET_PREVIEW, intent: 'SETUP' });
    await render();
    const text = container.textContent!;
    expect(text).toContain('resetPassword.setup.title');
    expect(text).toContain('resetPassword.setup.kicker');
    expect(text).toContain('resetPassword.setup.newPassword.label');
    expect(text).toContain('resetPassword.setup.submit');
    expect(text).toContain('resetPassword.setup.seal');
    expect(text).not.toContain('resetPassword.singleUseSeal');
  });

  it('a dead link (410) is reported before anything is typed, with a way to ask for another', async () => {
    mocks.preview.mockRejectedValueOnce(new FakeApiError(410, 'gone', undefined, 'RESET_TOKEN_INVALID'));
    await render();
    expect(container.querySelector('[data-testid="reset-invalid"]')).not.toBeNull();
    expect(container.textContent).toContain('resetPassword.invalid.title');
    expect(container.textContent).toContain('resetPassword.invalid.request');
    expect(container.querySelector('#newPassword')).toBeNull();
  });

  it('degrades to the neutral form when the backend has no preflight yet (404) or the network fails', async () => {
    mocks.preview.mockRejectedValueOnce(new FakeApiError(404, 'not here'));
    await render();
    expect(container.querySelector('#newPassword')).not.toBeNull();
    expect(container.textContent).toContain('resetPassword.title');
    expect(container.textContent).not.toContain('Constructora Andes');
  });

  it('counts characters, says when the minimum is met and refuses a short password with the missing count', async () => {
    mocks.preview.mockResolvedValueOnce(RESET_PREVIEW);
    await render();

    await typePassword(container, 'abcde');
    expect(container.querySelector('[data-testid="password-counter"]')!.textContent).toBe('5/100');
    expect(container.textContent).not.toContain('resetPassword.meetsMinimum');
    await submit(container);
    expect(container.textContent).toContain('resetPassword.newPassword.tooShort#3');
    expect(mocks.confirm).not.toHaveBeenCalled();

    await typePassword(container, 'abcdefgh');
    expect(container.textContent).toContain('resetPassword.meetsMinimum');
  });

  it('on success shows "Contraseña lista", then starts the welcome and enters the panel', async () => {
    mocks.preview.mockResolvedValueOnce(RESET_PREVIEW);
    mocks.confirm.mockResolvedValueOnce(SESSION);
    await render();
    vi.useFakeTimers();

    await typePassword(container, 'chosen-by-ana-26');
    await submit(container);

    expect(mocks.confirm).toHaveBeenCalledWith({ token: 'tok-123', newPassword: 'chosen-by-ana-26' });
    expect(mocks.setPasswordChangeRequired).toHaveBeenCalledWith(false);
    const done = container.querySelector('[data-testid="auth-done"]');
    expect(done).not.toBeNull();
    expect(done!.textContent).toContain('resetPassword.done.title');
    expect(done!.textContent).toContain('Ana Ruiz');
    expect(mocks.navigate).not.toHaveBeenCalled();

    await act(async () => { vi.advanceTimersByTime(DONE_MS + 10); });
    expect(mocks.startWelcome).toHaveBeenCalledWith('Ana Ruiz');
    expect(mocks.setWelcomeCompany).toHaveBeenCalledWith('Constructora Andes');
    expect(mocks.navigate).toHaveBeenCalledWith('/admin/dashboard');
  });

  it('maps confirm failures: 410 → dead link, 429 → minutes, anything else → server notice with retry', async () => {
    mocks.preview.mockResolvedValue(RESET_PREVIEW);
    mocks.confirm
      .mockRejectedValueOnce(new FakeApiError(429, 'slow', undefined, 'RATE_LIMITED'))
      .mockRejectedValueOnce(new FakeApiError(500, 'boom'))
      .mockRejectedValueOnce(new FakeApiError(410, 'gone', undefined, 'RESET_TOKEN_INVALID'));
    await render();
    await typePassword(container, 'chosen-by-ana-26');

    await submit(container);
    expect(container.textContent).toContain('resetPassword.rateLimited.message#30');

    await submit(container);
    expect(container.textContent).toContain('resetPassword.error.server.title');
    expect(container.textContent).toContain('resetPassword.retry');

    await submit(container);
    expect(container.querySelector('[data-testid="reset-invalid"]')).not.toBeNull();
  });
});
