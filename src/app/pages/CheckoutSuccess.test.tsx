import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

// Hoisted mocks — the page calls SignupService.completeSignup on mount
// when a signup intent is in sessionStorage. Tests drive both paths.
const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  completeSignup: vi.fn(),
  readSignupIntent: vi.fn(),
  clearSignupIntent: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => mocks.navigate,
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
}));

vi.mock('../services/signup', () => ({
  SignupService: {
    completeSignup: mocks.completeSignup,
  },
  readSignupIntent: mocks.readSignupIntent,
  clearSignupIntent: mocks.clearSignupIntent,
}));

vi.mock('../components/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <span data-testid="language-switcher" />,
}));

import { CheckoutSuccess } from './CheckoutSuccess';
import { ApiError } from '../lib/api';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function render(root: Root) {
  await act(async () => {
    root.render(<CheckoutSuccess />);
  });
}

async function settle() {
  // Let any pending microtasks (promise then/catch chains) flush.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('CheckoutSuccess pre-payment completion', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.completeSignup.mockReset();
    mocks.readSignupIntent.mockReset();
    mocks.clearSignupIntent.mockReset();

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('stays inert when no signup intent is in storage (billing upgrade flow)', async () => {
    mocks.readSignupIntent.mockReturnValue(null);

    await render(root);
    await settle();

    expect(mocks.completeSignup).not.toHaveBeenCalled();
    // The legacy success card renders (no completing spinner).
    expect(container.querySelector('[data-testid="signup-completing"]')).toBeNull();
    expect(container.querySelector('[data-testid="signup-success"]')).not.toBeNull();
  });

  it('calls /signup/complete and clears the stored intent on success', async () => {
    mocks.readSignupIntent.mockReturnValue({
      signupIntentId: 'uuid-1',
      planCode: 'PRO',
      billingInterval: 'ANNUAL',
    });
    mocks.completeSignup.mockResolvedValueOnce({
      role: 'ADMIN',
      username: 'admin',
      expiresInMinutes: 480,
    });

    await render(root);
    await settle();

    expect(mocks.completeSignup).toHaveBeenCalledWith({
      signupIntentId: 'uuid-1',
    });
    expect(mocks.clearSignupIntent).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="signup-success"]')).not.toBeNull();
  });

  it('routes to login on SIGNUP_INTENT_ALREADY_COMPLETED', async () => {
    mocks.readSignupIntent.mockReturnValue({
      signupIntentId: 'uuid-1',
      planCode: 'PRO',
      billingInterval: 'MONTHLY',
    });
    mocks.completeSignup.mockRejectedValueOnce(
      new ApiError(409, 'completed', undefined, 'SIGNUP_INTENT_ALREADY_COMPLETED'),
    );

    await render(root);
    await settle();

    expect(mocks.clearSignupIntent).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledWith('/login');
  });

  it('shows the expired failure surface on SIGNUP_INTENT_EXPIRED', async () => {
    mocks.readSignupIntent.mockReturnValue({
      signupIntentId: 'uuid-1',
      planCode: 'PRO',
      billingInterval: 'MONTHLY',
    });
    mocks.completeSignup.mockRejectedValueOnce(
      new ApiError(410, 'expired', undefined, 'SIGNUP_INTENT_EXPIRED'),
    );

    await render(root);
    await settle();

    expect(mocks.clearSignupIntent).toHaveBeenCalled();
    const failedEl = container.querySelector<HTMLElement>(
      '[data-testid="signup-failed"]',
    );
    expect(failedEl).not.toBeNull();
    expect(failedEl?.dataset.reason).toBe('expired');
  });

  it('shows the failed payment surface on SIGNUP_INTENT_FAILED', async () => {
    mocks.readSignupIntent.mockReturnValue({
      signupIntentId: 'uuid-1',
      planCode: 'PRO',
      billingInterval: 'MONTHLY',
    });
    mocks.completeSignup.mockRejectedValueOnce(
      new ApiError(409, 'payment failed', undefined, 'SIGNUP_INTENT_FAILED'),
    );

    await render(root);
    await settle();

    expect(mocks.clearSignupIntent).toHaveBeenCalled();
    const failedEl = container.querySelector<HTMLElement>(
      '[data-testid="signup-failed"]',
    );
    expect(failedEl).not.toBeNull();
    expect(failedEl?.dataset.reason).toBe('failed');
  });

  it('shows the failed payment surface on SIGNUP_PAYMENT_FAILED', async () => {
    mocks.readSignupIntent.mockReturnValue({
      signupIntentId: 'uuid-1',
      planCode: 'PRO',
      billingInterval: 'MONTHLY',
    });
    mocks.completeSignup.mockRejectedValueOnce(
      new ApiError(409, 'payment failed', undefined, 'SIGNUP_PAYMENT_FAILED'),
    );

    await render(root);
    await settle();

    expect(mocks.clearSignupIntent).toHaveBeenCalled();
    const failedEl = container.querySelector<HTMLElement>(
      '[data-testid="signup-failed"]',
    );
    expect(failedEl).not.toBeNull();
    expect(failedEl?.dataset.reason).toBe('failed');
    expect(container.querySelector('[data-testid="signup-success"]')).toBeNull();
  });

  it('shows waiting confirmation and keeps intent on SIGNUP_PAYMENT_NOT_CONFIRMED', async () => {
    mocks.readSignupIntent.mockReturnValue({
      signupIntentId: 'uuid-1',
      planCode: 'PRO',
      billingInterval: 'MONTHLY',
    });
    mocks.completeSignup.mockRejectedValueOnce(
      new ApiError(409, 'pending', undefined, 'SIGNUP_PAYMENT_NOT_CONFIRMED'),
    );

    await render(root);
    await settle();

    expect(mocks.clearSignupIntent).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="signup-waiting"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="signup-success"]')).toBeNull();
    expect(container.textContent).not.toContain('success.cta.dashboard');
  });

  it('shows the generic failure surface and keeps the intent on network errors', async () => {
    mocks.readSignupIntent.mockReturnValue({
      signupIntentId: 'uuid-1',
      planCode: 'PRO',
      billingInterval: 'MONTHLY',
    });
    mocks.completeSignup.mockRejectedValueOnce(new TypeError('Network error'));

    await render(root);
    await settle();

    // We keep the intent in storage so the user can simply refresh.
    expect(mocks.clearSignupIntent).not.toHaveBeenCalled();
    const failedEl = container.querySelector<HTMLElement>(
      '[data-testid="signup-failed"]',
    );
    expect(failedEl).not.toBeNull();
    expect(failedEl?.dataset.reason).toBe('generic');
  });
});
