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

// Hoist mocks so they're set up before module evaluation. We need to
// double-mock the signup service + the Paddle loader because the
// pre-payment flow calls both on submit.
const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  createCheckoutIntent: vi.fn(),
  rememberSignupIntent: vi.fn(),
  openCheckout: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => {
      if (key === 'signup.selectedPlan.title') return 'Selected plan';
      if (key === 'signup.selectedPlan.note') return 'No charge copy';
      if (key === 'signup.selectedPlan.interval') {
        return `Interval ${options?.interval ?? ''}`;
      }
      if (key === 'signup.selectedPlan.plan') {
        return `Plan ${options?.plan ?? ''}`;
      }
      if (key === 'signup.selectedPlan.plan.PRO') return 'Pro';
      if (key === 'signup.selectedPlan.plan.BUSINESS') return 'Business';
      if (key === 'signup.selectedPlan.interval.MONTHLY') return 'Monthly';
      if (key === 'signup.selectedPlan.interval.ANNUAL') return 'Annual';
      if (key === 'signup.adminEmail.invalid') return 'Invalid email';
      if (key === 'signup.adminPassword.tooShort') return 'Too short';
      if (key === 'signup.submit.continueToPayment') return 'Continue to payment';
      if (key === 'signup.submit.openingPaddle') return 'Opening Paddle…';
      if (key === 'signup.error.slugTaken.title') return 'Identifier unavailable';
      if (key === 'signup.error.slugTaken.message')
        return 'That identifier is already in use.';
      if (key === 'signup.error.slugInFlight.title') return 'Pending signup';
      if (key === 'signup.error.slugInFlight.message')
        return 'A signup is already pending for that identifier.';
      if (key === 'signup.error.paddleUnavailable.title')
        return 'Checkout unavailable';
      if (key === 'signup.error.paddleUnavailable.message')
        return 'We could not open the payment screen.';
      return key;
    },
  }),
}));

vi.mock('react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => mocks.navigate,
  useSearchParams: () => [mocks.searchParams],
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
    createCheckoutIntent: mocks.createCheckoutIntent,
  },
  rememberSignupIntent: mocks.rememberSignupIntent,
}));

vi.mock('../lib/paddle', () => ({
  openCheckout: mocks.openCheckout,
}));

vi.mock('../components/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <span data-testid="language-switcher" />,
}));

import { Signup } from './Signup';
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
  const button = container.querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  );
  expect(button).not.toBeNull();
  await act(async () => {
    button!.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function renderSignup(root: Root) {
  await act(async () => {
    root.render(<Signup />);
  });
}

async function fillValidSignupForm(container: HTMLElement) {
  await changeInput(container, 'companyName', 'Acme Construction');
  await changeInput(container, 'tenantSlug', 'acme');
  await changeInput(container, 'adminFullName', 'Ada Admin');
  await changeInput(container, 'adminEmail', 'ada@example.com');
  await changeInput(container, 'adminUsername', 'ada');
  await changeInput(container, 'adminPassword', 'password123');
}

describe('Signup pre-payment flow', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.createCheckoutIntent.mockReset();
    mocks.rememberSignupIntent.mockReset();
    mocks.openCheckout.mockReset();
    mocks.searchParams = new URLSearchParams('plan=PRO&interval=ANNUAL');

    mocks.createCheckoutIntent.mockResolvedValue({
      signupIntentId: 'intent-uuid-123',
      paddleTransactionId: 'txn_abc',
      transactionId: 'txn_abc',
      checkoutUrl: 'https://pay.paddle.com/abc',
      planCode: 'PRO',
      billingInterval: 'ANNUAL',
      expiresAt: '2026-05-13T16:00:00Z',
    });
    mocks.openCheckout.mockResolvedValue(undefined);

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

  it('submits to /signup/checkout (not /auth/signup) with plan + interval', async () => {
    await renderSignup(root);
    await fillValidSignupForm(container);
    await submit(container);

    expect(mocks.createCheckoutIntent).toHaveBeenCalledTimes(1);
    const payload = mocks.createCheckoutIntent.mock.calls[0][0];
    expect(payload).toEqual({
      companyName: 'Acme Construction',
      workspaceIdentifier: 'acme',
      adminFullName: 'Ada Admin',
      adminEmail: 'ada@example.com',
      adminUsername: 'ada',
      adminPassword: 'password123',
      planCode: 'PRO',
      billingInterval: 'ANNUAL',
    });
    // It MUST NOT carry priceId, amount, currency, tenantId, etc.
    expect(payload).not.toHaveProperty('priceId');
    expect(payload).not.toHaveProperty('amount');
    expect(payload).not.toHaveProperty('currency');
    expect(payload).not.toHaveProperty('tenantId');
  });

  it('persists the signupIntentId and opens Paddle on success', async () => {
    await renderSignup(root);
    await fillValidSignupForm(container);
    await submit(container);

    expect(mocks.rememberSignupIntent).toHaveBeenCalledWith({
      signupIntentId: 'intent-uuid-123',
      planCode: 'PRO',
      billingInterval: 'ANNUAL',
    });
    expect(mocks.openCheckout).toHaveBeenCalledTimes(1);
    const openCall = mocks.openCheckout.mock.calls[0][0];
    expect(openCall.transactionId).toBe('txn_abc');
    expect(openCall.settings?.successUrl).toMatch(/\/checkout\/success$/);
  });

  it('treats a retry checkout response as success instead of identifier unavailable', async () => {
    mocks.createCheckoutIntent.mockResolvedValueOnce({
      signupIntentId: 'retry-intent-456',
      paddleTransactionId: 'txn_retry',
      transactionId: 'txn_retry',
      checkoutUrl: 'https://pay.paddle.com/retry',
      planCode: 'PRO',
      billingInterval: 'ANNUAL',
      expiresAt: '2026-05-13T17:00:00Z',
    });

    await renderSignup(root);
    await fillValidSignupForm(container);
    await submit(container);

    expect(container.textContent).not.toContain('Identifier unavailable');
    expect(mocks.rememberSignupIntent).toHaveBeenCalledWith({
      signupIntentId: 'retry-intent-456',
      planCode: 'PRO',
      billingInterval: 'ANNUAL',
    });
    expect(mocks.openCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: 'txn_retry' }),
    );
  });

  it('does NOT navigate after success — Paddle controls the redirect', async () => {
    await renderSignup(root);
    await fillValidSignupForm(container);
    await submit(container);

    // We must not assume tenant creation succeeded — the only
    // navigation we'd be tempted to do would be wrong. Paddle's
    // success/cancel URL drives the next page.
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('shows an error when /signup/checkout reports a slug collision', async () => {
    mocks.createCheckoutIntent.mockRejectedValueOnce(
      new ApiError(409, 'taken', undefined, 'WORKSPACE_TAKEN'),
    );

    await renderSignup(root);
    await fillValidSignupForm(container);
    await submit(container);

    expect(mocks.rememberSignupIntent).not.toHaveBeenCalled();
    expect(mocks.openCheckout).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Identifier unavailable');
  });

  it('shows pending-signup copy when another email has an in-flight intent', async () => {
    mocks.createCheckoutIntent.mockRejectedValueOnce(
      new ApiError(409, 'pending', undefined, 'WORKSPACE_IN_FLIGHT'),
    );

    await renderSignup(root);
    await fillValidSignupForm(container);
    await submit(container);

    expect(mocks.rememberSignupIntent).not.toHaveBeenCalled();
    expect(mocks.openCheckout).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Pending signup');
    expect(container.textContent).not.toContain('Identifier unavailable');
  });

  it('continues activation when checkout reports the payment already returned', async () => {
    mocks.createCheckoutIntent.mockRejectedValueOnce(
      new ApiError(
        409,
        'already returned',
        undefined,
        'SIGNUP_PAYMENT_ALREADY_RETURNED',
      ),
    );

    await renderSignup(root);
    await fillValidSignupForm(container);
    await submit(container);

    expect(mocks.rememberSignupIntent).not.toHaveBeenCalled();
    expect(mocks.openCheckout).not.toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledWith('/checkout/success');
  });

  it('shows a paddleUnavailable error if Paddle.js fails to open', async () => {
    mocks.openCheckout.mockRejectedValueOnce(
      new Error('VITE_PADDLE_CLIENT_TOKEN is not set'),
    );

    await renderSignup(root);
    await fillValidSignupForm(container);
    await submit(container);

    expect(mocks.rememberSignupIntent).toHaveBeenCalled();
    expect(container.textContent).toContain('Checkout unavailable');
  });

  it('routes to pricing when no plan was selected', async () => {
    mocks.searchParams = new URLSearchParams();

    await renderSignup(root);
    await fillValidSignupForm(container);
    await submit(container);

    expect(mocks.createCheckoutIntent).not.toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledWith('/#pricing');
  });
});
