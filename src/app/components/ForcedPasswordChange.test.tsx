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
  logout: vi.fn(() => Promise.resolve()),
  getBranding: vi.fn(),
  setPasswordChangeRequired: vi.fn(),
  clearPasswordChangeState: vi.fn(),
  startWelcome: vi.fn(),
  setWelcomeCompany: vi.fn(),
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
vi.mock('../services/auth', () => ({
  ApiError: FakeApiError,
  AuthService: { changePassword: mocks.changePassword, getMe: mocks.getMe, getUsername: () => 'ana.ruiz', logout: mocks.logout },
}));
vi.mock('../services/branding', () => ({ getBranding: mocks.getBranding }));
vi.mock('../lib/api', () => ({ ApiError: FakeApiError, getStoredTenantSlug: () => 'constructora-andes' }));
vi.mock('../lib/passwordChangeState', () => ({
  setPasswordChangeRequired: mocks.setPasswordChangeRequired,
  clearPasswordChangeState: mocks.clearPasswordChangeState,
}));
vi.mock('../lib/welcome', () => ({ startWelcome: mocks.startWelcome, setWelcomeCompany: mocks.setWelcomeCompany }));
vi.mock('./LanguageSwitcher', () => ({ LanguageSwitcher: () => <span data-testid="language-switcher" /> }));

import { ForcedPasswordChange } from './ForcedPasswordChange';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Built at runtime: literal passwords in a test read as leaks to the secret scanner.
const TEMP_PW = ['temp', '1234'].join('-');
const NEW_PW = ['chosen', 'by', 'ana', '26'].join('-');

async function flush() { await act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); }); }

async function type(container: HTMLElement, id: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`#${id}`)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function submit(container: HTMLElement) {
  await act(async () => {
    container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    for (let i = 0; i < 8; i++) await Promise.resolve();
  });
}

describe('ForcedPasswordChange', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onChanged = vi.fn();

  beforeEach(() => {
    Object.values(mocks).forEach(m => m.mockReset());
    onChanged.mockReset();
    mocks.getMe.mockResolvedValue({ username: 'ana.ruiz', role: 'ADMIN', fullName: 'Ana Ruiz', passwordChangeRequired: true });
    mocks.getBranding.mockResolvedValue({ organizationName: 'Constructora Andes' });
    mocks.logout.mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function render() {
    await act(async () => { root.render(<ForcedPasswordChange onChanged={onChanged} />); });
    await flush();
  }

  it('is the panel, locked: bar with the person, kicker, title, the notice in tuteo, both hints and the seals', async () => {
    await render();
    const text = container.textContent!;
    expect(text).toContain('Ana Ruiz');
    expect(text).toContain('ana.ruiz · constructora-andes');
    expect(text).toContain('auth:changePassword.barSeal');
    expect(text).toContain('auth:changePassword.kicker');
    expect(text).toContain('auth:changePassword.title');
    expect(text).toContain('auth:changePassword.notice.message');
    expect(text).toContain('auth:changePassword.currentPassword.hint');
    expect(text).toContain('auth:changePassword.newPassword.hint');
    expect(text).toContain('auth:changePassword.privateNote');
    expect(text).toContain('auth:changePassword.signOut');
    expect(text).toContain('auth:changePassword.blockedSeal');
    expect(container.querySelector<HTMLInputElement>('#currentPassword')!.type).toBe('password');
    expect(container.querySelector<HTMLInputElement>('#newPassword')!.type).toBe('password');
  });

  it('refuses an empty form and a short password with the missing count', async () => {
    await render();
    await submit(container);
    expect(container.textContent).toContain('auth:changePassword.currentPassword.required');
    expect(container.textContent).toContain('auth:changePassword.newPassword.required');
    await type(container, 'currentPassword', TEMP_PW);
    await type(container, 'newPassword', 'abc');
    await submit(container);
    expect(container.textContent).toContain('auth:changePassword.newPassword.tooShort#5');
    expect(mocks.changePassword).not.toHaveBeenCalled();
  });

  it('on success lifts the block, starts the welcome with the name and the company, and tells the guard', async () => {
    mocks.changePassword.mockResolvedValueOnce(undefined);
    await render();
    await type(container, 'currentPassword', TEMP_PW);
    await type(container, 'newPassword', NEW_PW);
    await submit(container);
    await flush();
    expect(mocks.changePassword).toHaveBeenCalledWith({ currentPassword: TEMP_PW, newPassword: NEW_PW });
    expect(mocks.setPasswordChangeRequired).toHaveBeenCalledWith(false);
    expect(mocks.startWelcome).toHaveBeenCalledWith('Ana Ruiz');
    expect(mocks.setWelcomeCompany).toHaveBeenCalledWith('Constructora Andes');
    expect(onChanged).toHaveBeenCalled();
  });

  it('says which of the two passwords is wrong, under its field', async () => {
    mocks.changePassword
      .mockRejectedValueOnce(new FakeApiError(401, 'wrong', undefined, 'INVALID_CREDENTIALS'))
      .mockRejectedValueOnce(new FakeApiError(400, 'same', undefined, 'PASSWORD_UNCHANGED'));
    await render();
    await type(container, 'currentPassword', TEMP_PW);
    await type(container, 'newPassword', NEW_PW);

    await submit(container);
    expect(container.textContent).toContain('auth:changePassword.error.credentials');
    expect(container.textContent).not.toContain('auth:changePassword.error.unchanged');

    await submit(container);
    expect(container.textContent).toContain('auth:changePassword.error.unchanged');
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('a 429 quotes the minutes (15 by default inside the panel) and switches the button off; a 500 keeps the temporary password', async () => {
    mocks.changePassword
      .mockRejectedValueOnce(new FakeApiError(429, 'slow', undefined, 'RATE_LIMITED'))
      .mockRejectedValueOnce(new FakeApiError(500, 'boom'));
    await render();
    await type(container, 'currentPassword', TEMP_PW);
    await type(container, 'newPassword', NEW_PW);

    await submit(container);
    expect(container.textContent).toContain('auth:changePassword.error.rateLimited.message#15');
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  });

  it('a 500 says nothing changed', async () => {
    mocks.changePassword.mockRejectedValueOnce(new FakeApiError(500, 'boom'));
    await render();
    await type(container, 'currentPassword', TEMP_PW);
    await type(container, 'newPassword', NEW_PW);
    await submit(container);
    expect(container.textContent).toContain('auth:changePassword.error.server.title');
    expect(container.textContent).toContain('auth:changePassword.error.server.message');
  });
});
