import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted so the mocks exist before the module under test evaluates.
const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  navigate: vi.fn(),
  startWelcome: vi.fn(),
}));

// Passthrough translator: assertions key off the i18n keys, never the copy.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => mocks.navigate,
  useSearchParams: () => [new URLSearchParams()],
}));

vi.mock('../lib/api', () => ({
  // The bt_tenant cookie remembered a company: the field starts filled.
  getStoredTenantSlug: () => 'acme',
}));

vi.mock('../services/auth', () => {
  class ApiError extends Error {
    constructor(
      public status: number,
      message: string,
      public details?: unknown,
      public code?: string,
    ) {
      super(message);
      this.name = 'ApiError';
    }
  }
  return {
    ApiError,
    AuthService: { login: mocks.login, getDashboardRoute: () => '/admin' },
  };
});

vi.mock('../services/branding', () => ({
  getBranding: () => Promise.resolve({ organizationName: 'Acme' }),
}));

vi.mock('../lib/welcome', () => ({
  startWelcome: mocks.startWelcome,
  setWelcomeCompany: vi.fn(),
}));

vi.mock('../lib/passwordChangeState', () => ({
  setPasswordChangeRequired: vi.fn(),
}));

vi.mock('../components/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <span data-testid="language-switcher" />,
}));

import { Login } from './Login';
import { ApiError } from '../services/auth';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function changeInput(container: HTMLElement, id: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`#${id}`);
  expect(input).not.toBeNull();
  await act(async () => {
    const valueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;
    valueSetter?.call(input, value);
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    input!.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function submit(container: HTMLElement) {
  const button = container.querySelector<HTMLButtonElement>('button[type="submit"]');
  expect(button).not.toBeNull();
  await act(async () => {
    button!.click();
    // Flush react-hook-form's async validation and the awaited login call.
    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

/**
 * Which 401 is a wrong password. /auth/login answers 401 INVALID_CREDENTIALS
 * when the password is wrong — and 401 SESSION_REVOKED / INVALID_TOKEN when the
 * JWT filter refuses a dead session cookie the browser still carries, without
 * ever checking the password. The page must not read the second as the first
 * (2026-09-04: it did, wiped a correct password and blamed it).
 */
describe('Login — which 401 is a wrong password', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.login.mockReset();
    mocks.navigate.mockReset();
    mocks.startWelcome.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function render() {
    await act(async () => {
      root.render(<Login />);
    });
  }

  async function signIn(password = 'secreta-correcta') {
    await changeInput(container, 'username', 'ander.chulo');
    await changeInput(container, 'password', password);
    await submit(container);
  }

  const alertText = () => container.querySelector('[role="alert"]')?.textContent ?? '';
  const passwordValue = () => container.querySelector<HTMLInputElement>('#password')!.value;

  it('sends exactly what was typed, scoped to the remembered company', async () => {
    mocks.login.mockRejectedValueOnce(new ApiError(401, 'x', undefined, 'INVALID_CREDENTIALS'));
    await render();
    await signIn();
    expect(mocks.login).toHaveBeenCalledTimes(1);
    expect(mocks.login).toHaveBeenCalledWith(
      { username: 'ander.chulo', password: 'secreta-correcta' },
      'acme',
    );
  });

  it('INVALID_CREDENTIALS: blames the password and clears it', async () => {
    mocks.login.mockRejectedValueOnce(
      new ApiError(401, 'Invalid username or password', undefined, 'INVALID_CREDENTIALS'),
    );
    await render();
    await signIn();
    expect(alertText()).toContain('auth:login.error.invalidCredentials.title');
    expect(passwordValue()).toBe('');
    expect(container.textContent).toContain('auth:login.password.cleared');
  });

  it('SESSION_REVOKED: names the stale session and keeps the password typed', async () => {
    mocks.login.mockRejectedValueOnce(
      new ApiError(401, 'Your session has been revoked', undefined, 'SESSION_REVOKED'),
    );
    await render();
    await signIn();
    expect(alertText()).toContain('auth:login.error.staleSession.title');
    expect(alertText()).not.toContain('auth:login.error.invalidCredentials.title');
    expect(passwordValue()).toBe('secreta-correcta');
    expect(container.textContent).not.toContain('auth:login.password.cleared');
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('a 401 without a code still reads as wrong credentials', async () => {
    mocks.login.mockRejectedValueOnce(new ApiError(401, 'Unauthorized'));
    await render();
    await signIn();
    expect(alertText()).toContain('auth:login.error.invalidCredentials.title');
    expect(passwordValue()).toBe('');
  });
});
