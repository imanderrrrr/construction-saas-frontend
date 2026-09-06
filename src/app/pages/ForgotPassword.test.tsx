import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hoist the service mock so it's wired before the module under test evaluates.
const mocks = vi.hoisted(() => ({
  request: vi.fn(),
}));

// Passthrough translator: assertions key off the i18n keys themselves so the
// test never couples to the exact (and tweakable) copy strings. Interpolated
// numbers are appended so a screen that quotes minutes can be checked.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts && 'minutes' in opts ? `${key}#${opts.minutes}` : key),
    i18n: { language: 'es' },
  }),
}));

vi.mock('react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('../lib/api', () => ({
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      message: string,
      public details?: unknown,
      public code?: string,
      public retryAfterSeconds?: number,
    ) {
      super(message);
      this.name = 'ApiError';
    }
  },
  // No remembered tenant — the field starts empty and we fill it in each test.
  getStoredTenantSlug: () => '',
}));

vi.mock('../services/passwordReset', () => ({
  PasswordResetService: { request: mocks.request },
}));

vi.mock('../components/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <span data-testid="language-switcher" />,
}));

import { ForgotPassword } from './ForgotPassword';
import { ApiError } from '../lib/api';

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
    // Flush react-hook-form's async validation + the awaited service call.
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
}

async function fillValidForm(container: HTMLElement) {
  await changeInput(container, 'tenantSlug', 'acme');
  await changeInput(container, 'email', 'ada@example.com');
}

/** Did the page switch to the generic "check your email" panel? */
function showsSuccessView(container: HTMLElement): boolean {
  return (
    container.querySelector('[data-testid="forgot-sent"]') !== null &&
    container.textContent!.includes('forgotPassword.sentBody') &&
    container.querySelector('button[type="submit"]') === null
  );
}

describe('ForgotPassword — transport success vs failure', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.request.mockReset();
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
      root.render(<ForgotPassword />);
    });
  }

  it('renders the sheet: ink kicker and stamps, paper kicker, the "which email" hint and the expiry seal', async () => {
    await render();
    const text = container.textContent!;
    expect(text).toContain('forgotPassword.kicker');
    expect(text).toContain('forgotPassword.hero.ttlValue');
    expect(text).toContain('forgotPassword.paperKicker');
    expect(text).toContain('forgotPassword.email.hint');
    expect(text).toContain('forgotPassword.tenantSlug.help');
    expect(text).toContain('forgotPassword.expiresSeal');
  });

  it('shows the generic sent panel when the request resolves (HTTP 204), keeping the composition', async () => {
    mocks.request.mockResolvedValueOnce(undefined);

    await render();
    await fillValidForm(container);
    await submit(container);

    expect(mocks.request).toHaveBeenCalledTimes(1);
    // Slug normalised (trim + lowercase) and email trimmed — the
    // anti-enumeration normalisation is untouched.
    expect(mocks.request).toHaveBeenCalledWith({ tenantSlug: 'acme', email: 'ada@example.com' });
    expect(showsSuccessView(container)).toBe(true);
    const text = container.textContent!;
    expect(text).toContain('forgotPassword.sent.chip');
    expect(text).toContain('forgotPassword.sent.expires');
    expect(text).toContain('forgotPassword.sent.once');
    expect(text).toContain('forgotPassword.sent.again');
    // The ink column is still there.
    expect(text).toContain('forgotPassword.hero.title');
  });

  it('"Enviar de nuevo" returns to the form', async () => {
    mocks.request.mockResolvedValueOnce(undefined);
    await render();
    await fillValidForm(container);
    await submit(container);
    expect(showsSuccessView(container)).toBe(true);

    const again = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('forgotPassword.sent.again'))!;
    await act(async () => { again.click(); });
    expect(container.querySelector('button[type="submit"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="forgot-sent"]')).toBeNull();
  });

  it('keeps the form and shows the red server notice with a retry when the request rejects (5xx)', async () => {
    mocks.request.mockRejectedValueOnce(new ApiError(500, 'boom'));

    await render();
    await fillValidForm(container);
    await submit(container);

    expect(showsSuccessView(container)).toBe(false);
    expect(container.querySelector('button[type="submit"]')).not.toBeNull();
    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert!.textContent).toContain('forgotPassword.serverError.title');
    expect(alert!.textContent).toContain('forgotPassword.error');
    expect(alert!.textContent).toContain('forgotPassword.retry');
    expect(container.textContent).not.toContain('forgotPassword.sentBody');
  });

  it('shows the generic error (not the rate-limit one) on a network/timeout failure', async () => {
    mocks.request.mockRejectedValueOnce(new Error('The user aborted a request.'));

    await render();
    await fillValidForm(container);
    await submit(container);

    expect(showsSuccessView(container)).toBe(false);
    expect(container.textContent).toContain('forgotPassword.error');
    expect(container.textContent).not.toContain('forgotPassword.rateLimited');
  });

  it('a 429 shows the orange notice with the minutes to wait and switches the button off', async () => {
    mocks.request.mockRejectedValueOnce(new ApiError(429, 'Too Many Requests', undefined, 'RATE_LIMITED'));

    await render();
    await fillValidForm(container);
    await submit(container);

    expect(showsSuccessView(container)).toBe(false);
    const text = container.textContent!;
    expect(text).toContain('forgotPassword.rateLimited.title');
    // No Retry-After reaches the mocked error: the public default of 30 minutes.
    expect(text).toContain('forgotPassword.rateLimited.message#30');
    expect(text).toContain('forgotPassword.rateLimited.note');
    const button = container.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(button.disabled).toBe(true);
  });

  it('clears a prior error and shows the sent panel when a retry resolves', async () => {
    mocks.request
      .mockRejectedValueOnce(new ApiError(503, 'cold start'))
      .mockResolvedValueOnce(undefined);

    await render();
    await fillValidForm(container);
    await submit(container);
    expect(container.querySelector('[role="alert"]')).not.toBeNull();

    await submit(container);
    expect(showsSuccessView(container)).toBe(true);
    expect(mocks.request).toHaveBeenCalledTimes(2);
  });
});
