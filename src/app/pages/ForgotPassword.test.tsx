import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hoist the service mock so it's wired before the module under test evaluates.
const mocks = vi.hoisted(() => ({
  request: vi.fn(),
}));

// Passthrough translator: assertions key off the i18n keys themselves so the
// test never couples to the exact (and tweakable) copy strings.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
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
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function fillValidForm(container: HTMLElement) {
  await changeInput(container, 'tenantSlug', 'acme');
  await changeInput(container, 'email', 'ada@example.com');
}

/** Did the page switch to the generic "check your email" success view? */
function showsSuccessView(container: HTMLElement): boolean {
  return (
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

  it('renders the "which email" hint on the email field', async () => {
    await render();
    expect(container.textContent).toContain('forgotPassword.email.hint');
  });

  it('shows the generic success view when the request resolves (HTTP 204)', async () => {
    mocks.request.mockResolvedValueOnce(undefined);

    await render();
    await fillValidForm(container);
    await submit(container);

    expect(mocks.request).toHaveBeenCalledTimes(1);
    // Slug normalised (trim + lowercase) and email trimmed, exactly as before —
    // the anti-enumeration normalisation is untouched.
    expect(mocks.request).toHaveBeenCalledWith({
      tenantSlug: 'acme',
      email: 'ada@example.com',
    });
    expect(showsSuccessView(container)).toBe(true);
    // No false-failure noise: the error alert must NOT be present.
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('keeps the form and shows a generic error when the request rejects (5xx)', async () => {
    mocks.request.mockRejectedValueOnce(new ApiError(500, 'boom'));

    await render();
    await fillValidForm(container);
    await submit(container);

    // The false-success bug: success view must NOT show on a real failure.
    expect(showsSuccessView(container)).toBe(false);
    expect(container.querySelector('button[type="submit"]')).not.toBeNull();
    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert!.textContent).toContain('forgotPassword.error');
    expect(container.textContent).not.toContain('forgotPassword.sentBody');
  });

  it('shows the generic error (not the rate-limit one) on a network/timeout failure', async () => {
    // Timeouts (AbortError) and network drops surface as plain Errors, NOT
    // ApiError — they must fall into the generic bucket, never the 429 copy.
    mocks.request.mockRejectedValueOnce(new Error('The user aborted a request.'));

    await render();
    await fillValidForm(container);
    await submit(container);

    expect(showsSuccessView(container)).toBe(false);
    expect(container.textContent).toContain('forgotPassword.error');
    expect(container.textContent).not.toContain('forgotPassword.rateLimited');
  });

  it('shows the rate-limit message when the request rejects with 429', async () => {
    mocks.request.mockRejectedValueOnce(new ApiError(429, 'Too Many Requests'));

    await render();
    await fillValidForm(container);
    await submit(container);

    expect(showsSuccessView(container)).toBe(false);
    expect(container.querySelector('button[type="submit"]')).not.toBeNull();
    expect(container.textContent).toContain('forgotPassword.rateLimited');
    expect(container.textContent).not.toContain('forgotPassword.sentBody');
  });

  it('clears a prior error and shows success when a retry resolves', async () => {
    // First attempt fails (e.g. cold-start timeout), second succeeds.
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
