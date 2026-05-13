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

import enBilling from '../../../i18n/locales/en/billing.json';
import esBilling from '../../../i18n/locales/es/billing.json';

const mocks = vi.hoisted(() => ({
  changeLanguage: vi.fn(),
  createCheckout: vi.fn(),
  getStatus: vi.fn(),
  navigate: vi.fn(),
  openCheckout: vi.fn(),
  searchParams: new URLSearchParams(),
}));

// Mock t() so the assertions can match either explicit copy (for the
// keys we care about reading in the DOM) or the raw key (so we never
// have to keep two copies of every translation in sync with the test).
const EXPLICIT_BILLING_KEYS: Record<
  string,
  string | ((options?: Record<string, string>) => string)
> = {
  'error.title': 'Billing error',
  'error.missingToken': 'Missing Paddle client token.',
  'error.generic': 'Generic billing error.',
  'error.network': 'Network billing error.',
  'card.cta.checkout': (options) =>
    `Checkout ${options?.plan ?? ''}`.trim(),
  'card.cta.startCheckout': (options) =>
    `Start checkout for ${options?.plan ?? ''}`.trim(),
  'card.cta.retryCheckout': (options) =>
    `Retry ${options?.plan ?? ''} checkout`.trim(),
  'card.cta.currentPlan': 'Current plan',
  'card.cta.processing': 'Processing',
  'card.cta.hint':
    'Subscription management is being finalized for beta. Contact support if you need billing help.',
  'card.cta.hintCurrent': "You're already on this plan.",
  'card.cta.hintAlternative':
    "Starts a new checkout — it doesn't replace your current subscription.",
  'card.badge.current': 'Current plan badge',
  'card.badge.upgrade': 'Upgrade',
  'selectedFromSignup.title': 'Selected from signup',
  'selectedFromSignup.body': 'You can change it before checkout.',
  'selectedFromSignup.badge': 'Selected plan',
  'page.title': 'Billing & Subscription',
  'page.subtitle':
    'Manage your BuildTrack plan, checkout status, and subscription details.',
  'status.title': 'Current subscription',
  'status.configured': 'Local billing state confirmed by Paddle webhooks.',
  'status.refresh': 'Refresh status',
  'status.refreshing': 'Refreshing status',
  'status.empty.title': 'No subscription yet',
  'status.empty.body': 'Start checkout to configure billing.',
  'status.field.status': 'Status',
  'status.field.plan': 'Plan',
  'status.field.interval': 'Interval',
  'status.field.paddleEnv': 'Paddle environment',
  'status.field.lastEvent': 'Last event',
  'status.field.periodEnds': 'Current period ends',
  'status.headline.active': 'Your subscription is active.',
  'status.headline.trialing': 'Your trial is active.',
  'status.headline.pending': 'Checkout pending headline',
  'status.headline.missing': 'No subscription yet headline',
  'status.headline.pastDue': 'Past due headline',
  'status.headline.paymentRequired': 'Payment required headline',
  'status.headline.canceled': 'Canceled headline',
  'status.headline.expired': 'Expired headline',
  'status.headline.incomplete': 'Incomplete headline',
  'status.headline.unknown': 'Unknown headline',
  'status.headline.error': "We couldn't verify your subscription status.",
  'status.body.active': 'You have full access to BuildTrack.',
  'status.body.trialing': "You're on a free trial.",
  'status.body.pending':
    "We're waiting for Paddle to confirm your payment. You can refresh or retry checkout.",
  'status.body.missing': 'Choose a plan to start your 14-day trial.',
  'status.body.pastDue': 'Retry checkout to settle the balance.',
  'status.body.paymentRequired': 'Start a new checkout.',
  'status.body.canceled': 'Reactivate by starting a new checkout.',
  'status.body.expired': 'Choose a plan to reactivate.',
  'status.body.incomplete': 'Finish checkout.',
  'status.body.unknown': 'Refresh status.',
  'status.body.error':
    'Refresh the page or try again. If the issue continues, contact support.',
  'status.badge.active': 'Active',
  'status.badge.trialing': 'Trial active',
  'status.badge.pending': 'Checkout pending',
  'status.badge.missing': 'No subscription',
  'status.badge.pastDue': 'Past due',
  'status.badge.paymentRequired': 'Payment required',
  'status.badge.canceled': 'Canceled',
  'status.badge.expired': 'Expired',
  'status.badge.incomplete': 'Incomplete',
  'status.badge.unknown': 'Unknown',
  'status.badge.error': 'Status error',
  'status.cta.retry': 'Retry checkout',
  'status.cta.choosePlan': 'See plans',
  'manage.title': 'Manage subscription',
  'manage.subtitle': 'Update your plan, cancel, or review billing history.',
  'manage.changePlan.title': 'Change plan',
  'manage.changePlan.body': 'Switch to a different plan.',
  'manage.changePlan.cta': 'Coming soon (change plan)',
  'manage.cancel.title': 'Cancel subscription',
  'manage.cancel.body': 'End your subscription.',
  'manage.cancel.cta': 'Coming soon (cancel)',
  'manage.invoices.title': 'Billing history',
  'manage.invoices.body': 'Download invoices.',
  'manage.invoices.cta': 'Coming soon (invoices)',
  'manage.notice.cancelTitle': 'Cancellation coming soon',
  'manage.notice.cancelBody':
    'Cancellation management is coming soon for beta.',
  'manage.notice.changePlanTitle': 'Plan changes coming soon',
  'manage.notice.changePlanBody':
    "Plan changes are coming soon for beta. Starts a new checkout, doesn't replace current.",
  'manage.notice.invoicesTitle': 'Billing history coming soon',
  'manage.notice.invoicesBody':
    'Invoice history will be available in a future release.',
  'manage.notice.close': 'Got it',
  'manage.notice.badge': 'Beta',
  'plans.title': 'Available plans',
  'plans.subtitleDefault': 'Pick the plan that fits your operation.',
  'plans.subtitleActive':
    'You can start a checkout for any plan. Plan switching is coming soon.',
};

vi.mock('react-i18next', () => ({
  useTranslation: (namespace?: string) => ({
    i18n: {
      language: 'en',
      changeLanguage: mocks.changeLanguage,
    },
    t: (key: string, options?: Record<string, string>) => {
      if (namespace === 'billing' && key in EXPLICIT_BILLING_KEYS) {
        const value = EXPLICIT_BILLING_KEYS[key];
        return typeof value === 'function' ? value(options) : value;
      }
      if (namespace === 'pricing' && key.endsWith('.name')) {
        return key.includes('.pro.') ? 'Pro' : 'Business';
      }

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

vi.mock('../../components/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <span data-testid="language-switcher" />,
}));

vi.mock('../../lib/api', () => ({
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

vi.mock('../../lib/paddle', () => ({
  openCheckout: mocks.openCheckout,
}));

// AuthService is imported by the activation panel's "Sign out" handler.
// Mock the logout method so a click in tests doesn't fire a real network
// call.
vi.mock('../../services/auth', () => ({
  AuthService: {
    logout: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/billing', async () => {
  const actual =
    await vi.importActual<typeof import('../../services/billing')>(
      '../../services/billing',
    );

  return {
    ...actual,
    BillingService: {
      createCheckout: mocks.createCheckout,
      getStatus: mocks.getStatus,
    },
  };
});

import { BillingPage } from './BillingPage';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function checkoutButtons(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button')).filter(
    (button): button is HTMLButtonElement =>
      /Checkout|Retry|Start checkout/i.test(button.textContent ?? ''),
  );
}

function findButtonByText(
  container: HTMLElement,
  needle: string,
): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find(
    (button): button is HTMLButtonElement =>
      button.textContent?.includes(needle) ?? false,
  ) as HTMLButtonElement | undefined;
}

async function flushReactWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function emptyStatus() {
  return {
    billingStatus: null,
    planCode: null,
    billingInterval: null,
    paddleEnv: null,
    currentPeriodEndsAt: null,
    lastEventId: null,
    lastEventOccurredAt: null,
  };
}

describe('BillingPage status and checkout', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.changeLanguage.mockReset();
    mocks.createCheckout.mockReset();
    mocks.getStatus.mockReset();
    mocks.getStatus.mockResolvedValue(emptyStatus());
    mocks.navigate.mockReset();
    mocks.openCheckout.mockReset();
    mocks.searchParams = new URLSearchParams();

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

  it('renders the subscription-management heading at the top of the page', async () => {
    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    const h1 = container.querySelector('h1');
    expect(h1?.textContent).toBe('Billing & Subscription');
  });

  it('requests billing status when the page mounts without sending tenant fields', async () => {
    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    expect(mocks.getStatus).toHaveBeenCalledTimes(1);
    expect(mocks.getStatus).toHaveBeenCalledWith();
  });

  it('shows the current billing status when one exists', async () => {
    mocks.getStatus.mockResolvedValueOnce({
      billingStatus: 'ACTIVE',
      planCode: 'PRO',
      billingInterval: 'ANNUAL',
      paddleEnv: 'sandbox',
      currentPeriodEndsAt: '2026-06-01T00:00:00Z',
      lastEventId: 'evt_status_123',
      lastEventOccurredAt: '2026-05-01T12:30:00Z',
    });

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    expect(container.textContent).toContain('Current subscription');
    expect(container.textContent).toContain('ACTIVE');
    expect(container.textContent).toContain('PRO');
    expect(container.textContent).toContain('ANNUAL');
    expect(container.textContent).toContain('sandbox');
    expect(container.textContent).toContain('evt_status_123');
  });

  it('shows a safe empty state when billing status has no local account', async () => {
    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    expect(container.textContent).toContain('Current subscription');
    expect(container.textContent).toContain('No subscription yet');
    expect(container.textContent).toContain('Start checkout to configure billing.');
  });

  it('refresh button asks for billing status again', async () => {
    mocks.getStatus
      .mockResolvedValueOnce(emptyStatus())
      .mockResolvedValueOnce({
        billingStatus: 'CHECKOUT_PENDING',
        planCode: 'BUSINESS',
        billingInterval: 'MONTHLY',
        paddleEnv: 'sandbox',
        currentPeriodEndsAt: null,
        lastEventId: 'evt_pending_456',
        lastEventOccurredAt: '2026-05-02T10:00:00Z',
      });

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    const refreshButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="status-refresh-button"]',
    );
    expect(refreshButton).not.toBeNull();

    await act(async () => {
      refreshButton?.click();
      await flushReactWork();
    });

    expect(mocks.getStatus).toHaveBeenCalledTimes(2);
    expect(mocks.getStatus).toHaveBeenLastCalledWith();
    expect(container.textContent).toContain('CHECKOUT_PENDING');
    expect(container.textContent).toContain('evt_pending_456');
  });

  it('keeps the missing Paddle token message instead of replacing it with generic copy', async () => {
    mocks.createCheckout.mockResolvedValueOnce({ transactionId: 'txn_123' });
    mocks.openCheckout.mockRejectedValueOnce(
      new Error('VITE_PADDLE_CLIENT_TOKEN is not set.'),
    );

    await act(async () => {
      root.render(<BillingPage />);
    });

    const [proCheckout] = checkoutButtons(container);
    expect(proCheckout).toBeDefined();

    await act(async () => {
      proCheckout.click();
      await flushReactWork();
    });

    const alert = container.querySelector('[role="alert"]');

    expect(alert?.textContent).toContain('Missing Paddle client token.');
    expect(alert?.textContent).not.toContain('Generic billing error.');
  });

  it('shows the CHECKOUT_PENDING activation banner and the checkout buttons stay enabled for retry', async () => {
    mocks.getStatus.mockResolvedValueOnce({
      billingStatus: 'CHECKOUT_PENDING',
      planCode: 'PRO',
      billingInterval: 'MONTHLY',
      paddleEnv: 'sandbox',
      currentPeriodEndsAt: null,
      lastEventId: null,
      lastEventOccurredAt: null,
    });

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    const panel = container.querySelector('[data-testid="billing-activation-panel"]');
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute('data-variant')).toBe('pending');
    expect(panel?.textContent).toContain('activation.pending.title');
    expect(panel?.textContent).toContain('activation.pending.body');

    // Retry checkout is still available — the cards aren't busy.
    const [proCheckout] = checkoutButtons(container);
    expect(proCheckout).toBeDefined();
    expect(proCheckout.disabled).toBe(false);

    // The status panel also surfaces an inline "Retry checkout" CTA.
    const inlineRetry = container.querySelector(
      '[data-testid="status-retry-checkout"]',
    );
    expect(inlineRetry).not.toBeNull();
  });

  it('reuses the pending plan + interval when the status-panel "Retry checkout" is clicked', async () => {
    mocks.getStatus.mockResolvedValueOnce({
      billingStatus: 'CHECKOUT_PENDING',
      planCode: 'BUSINESS',
      billingInterval: 'ANNUAL',
      paddleEnv: 'sandbox',
      currentPeriodEndsAt: null,
      lastEventId: null,
      lastEventOccurredAt: null,
    });
    mocks.createCheckout.mockResolvedValueOnce({ transactionId: 'txn_retry' });
    mocks.openCheckout.mockResolvedValueOnce(undefined);

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    const retryButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="status-retry-checkout"]',
    );
    expect(retryButton).not.toBeNull();

    await act(async () => {
      retryButton?.click();
      await flushReactWork();
    });

    expect(mocks.createCheckout).toHaveBeenCalledTimes(1);
    expect(mocks.createCheckout).toHaveBeenCalledWith({
      planCode: 'BUSINESS',
      billingInterval: 'ANNUAL',
    });
    expect(mocks.openCheckout).toHaveBeenCalledTimes(1);
  });

  it('shows the missing-subscription banner when billingStatus is null', async () => {
    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    const panel = container.querySelector('[data-testid="billing-activation-panel"]');
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute('data-variant')).toBe('missing');
    expect(panel?.textContent).toContain('activation.required.title');
    expect(panel?.textContent).toContain('activation.required.body');
    expect(panel?.textContent).toContain('activation.required.cta');
  });

  it('shows the status-error banner with role="alert" when the status fetch fails', async () => {
    mocks.getStatus.mockReset();
    mocks.getStatus.mockRejectedValue(new Error('fetch broke'));

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    const panel = container.querySelector('[data-testid="billing-activation-panel"]');
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute('data-variant')).toBe('error');
    expect(panel?.getAttribute('role')).toBe('alert');
    expect(panel?.textContent).toContain('activation.statusError.title');
    expect(panel?.textContent).toContain('activation.statusError.body');

    // After a status error the page must still allow a manual refresh.
    const refresh = container.querySelector(
      '[data-testid="status-refresh-button"]',
    );
    expect(refresh).not.toBeNull();
  });

  it('does not show any activation banner when billingStatus is ACTIVE', async () => {
    mocks.getStatus.mockReset();
    mocks.getStatus.mockResolvedValueOnce({
      billingStatus: 'ACTIVE',
      planCode: 'PRO',
      billingInterval: 'ANNUAL',
      paddleEnv: 'sandbox',
      currentPeriodEndsAt: '2026-06-01T00:00:00Z',
      lastEventId: 'evt_1',
      lastEventOccurredAt: '2026-05-01T12:30:00Z',
    });

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    expect(
      container.querySelector('[data-testid="billing-activation-panel"]'),
    ).toBeNull();
  });

  it('renders the active status badge and active headline when subscription is ACTIVE', async () => {
    mocks.getStatus.mockReset();
    mocks.getStatus.mockResolvedValueOnce({
      billingStatus: 'ACTIVE',
      planCode: 'PRO',
      billingInterval: 'MONTHLY',
      paddleEnv: 'sandbox',
      currentPeriodEndsAt: '2026-06-01T00:00:00Z',
      lastEventId: 'evt_1',
      lastEventOccurredAt: null,
    });

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    const statusPanel = container.querySelector(
      '[data-testid="subscription-status-panel"]',
    );
    expect(statusPanel?.getAttribute('data-kind')).toBe('active');

    const badge = container.querySelector('[data-testid="status-badge"]');
    expect(badge?.textContent).toBe('Active');
    expect(statusPanel?.textContent).toContain('Your subscription is active.');
  });

  it('renders the trialing status badge and trialing headline when subscription is TRIALING', async () => {
    mocks.getStatus.mockReset();
    mocks.getStatus.mockResolvedValueOnce({
      billingStatus: 'TRIALING',
      planCode: 'BUSINESS',
      billingInterval: 'ANNUAL',
      paddleEnv: 'sandbox',
      currentPeriodEndsAt: '2026-06-01T00:00:00Z',
      lastEventId: 'evt_trial',
      lastEventOccurredAt: null,
    });

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    const statusPanel = container.querySelector(
      '[data-testid="subscription-status-panel"]',
    );
    expect(statusPanel?.getAttribute('data-kind')).toBe('trialing');

    const badge = container.querySelector('[data-testid="status-badge"]');
    expect(badge?.textContent).toBe('Trial active');
    expect(statusPanel?.textContent).toContain('Your trial is active.');
  });

  it('marks the current plan card and disables its CTA when subscription is ACTIVE', async () => {
    mocks.getStatus.mockReset();
    mocks.getStatus.mockResolvedValueOnce({
      billingStatus: 'ACTIVE',
      planCode: 'PRO',
      billingInterval: 'MONTHLY',
      paddleEnv: 'sandbox',
      currentPeriodEndsAt: '2026-06-01T00:00:00Z',
      lastEventId: 'evt_active',
      lastEventOccurredAt: null,
    });

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    const proCard = container.querySelector('[data-testid="plan-card-pro"]');
    expect(proCard?.getAttribute('data-current')).toBe('true');
    const proButton = proCard?.querySelector<HTMLButtonElement>('button');
    expect(proButton?.disabled).toBe(true);
    expect(proButton?.textContent).toContain('Current plan');

    const businessCard = container.querySelector(
      '[data-testid="plan-card-business"]',
    );
    expect(businessCard?.getAttribute('data-current')).toBe('false');
    const businessButton = businessCard?.querySelector<HTMLButtonElement>(
      'button',
    );
    expect(businessButton?.disabled).toBe(false);
    expect(businessButton?.textContent).toContain('Start checkout for Business');
    // Honest hint: a new checkout doesn't actually swap the existing plan.
    expect(businessCard?.textContent).toContain(
      "Starts a new checkout — it doesn't replace your current subscription.",
    );
  });

  it('shows the Manage subscription section only when subscription is ACTIVE or TRIALING', async () => {
    mocks.getStatus.mockReset();
    mocks.getStatus.mockResolvedValueOnce({
      billingStatus: 'ACTIVE',
      planCode: 'PRO',
      billingInterval: 'MONTHLY',
      paddleEnv: 'sandbox',
      currentPeriodEndsAt: '2026-06-01T00:00:00Z',
      lastEventId: 'evt_active',
      lastEventOccurredAt: null,
    });

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    expect(
      container.querySelector('[data-testid="manage-subscription-section"]'),
    ).not.toBeNull();
  });

  it('hides the Manage subscription section when subscription is missing', async () => {
    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    expect(
      container.querySelector('[data-testid="manage-subscription-section"]'),
    ).toBeNull();
  });

  it('clicking "Cancel subscription" shows a Coming-soon notice and does not call any service', async () => {
    mocks.getStatus.mockReset();
    mocks.getStatus.mockResolvedValueOnce({
      billingStatus: 'ACTIVE',
      planCode: 'PRO',
      billingInterval: 'MONTHLY',
      paddleEnv: 'sandbox',
      currentPeriodEndsAt: '2026-06-01T00:00:00Z',
      lastEventId: 'evt_active',
      lastEventOccurredAt: null,
    });

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    const cancelButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="manage-action-cancel"]',
    );
    expect(cancelButton).not.toBeNull();

    await act(async () => {
      cancelButton?.click();
      await flushReactWork();
    });

    const notice = container.querySelector('[data-testid="manage-notice"]');
    expect(notice).not.toBeNull();
    expect(notice?.getAttribute('data-action')).toBe('cancel');
    expect(notice?.textContent).toContain(
      'Cancellation management is coming soon for beta.',
    );

    // No backend call must have been made for cancel — it isn't wired.
    expect(mocks.createCheckout).not.toHaveBeenCalled();
    expect(mocks.getStatus).toHaveBeenCalledTimes(1); // only the mount fetch
  });

  it('clicking "Change plan" shows a notice that is honest about not replacing the current subscription', async () => {
    mocks.getStatus.mockReset();
    mocks.getStatus.mockResolvedValueOnce({
      billingStatus: 'TRIALING',
      planCode: 'PRO',
      billingInterval: 'MONTHLY',
      paddleEnv: 'sandbox',
      currentPeriodEndsAt: '2026-06-01T00:00:00Z',
      lastEventId: 'evt_trial',
      lastEventOccurredAt: null,
    });

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    const changePlanButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="manage-action-change-plan"]',
    );
    expect(changePlanButton).not.toBeNull();

    await act(async () => {
      changePlanButton?.click();
      await flushReactWork();
    });

    const notice = container.querySelector('[data-testid="manage-notice"]');
    expect(notice?.getAttribute('data-action')).toBe('changePlan');
    expect(notice?.textContent).toContain(
      "Plan changes are coming soon for beta. Starts a new checkout, doesn't replace current.",
    );

    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it('clicking "Billing history" shows a coming-soon notice and does not call any service', async () => {
    mocks.getStatus.mockReset();
    mocks.getStatus.mockResolvedValueOnce({
      billingStatus: 'ACTIVE',
      planCode: 'BUSINESS',
      billingInterval: 'ANNUAL',
      paddleEnv: 'sandbox',
      currentPeriodEndsAt: '2026-06-01T00:00:00Z',
      lastEventId: 'evt_active',
      lastEventOccurredAt: null,
    });

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    const invoicesButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="manage-action-invoices"]',
    );

    await act(async () => {
      invoicesButton?.click();
      await flushReactWork();
    });

    const notice = container.querySelector('[data-testid="manage-notice"]');
    expect(notice?.getAttribute('data-action')).toBe('invoices');
    expect(notice?.textContent).toContain(
      'Invoice history will be available in a future release.',
    );

    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it('manage-notice can be dismissed and another action can be opened in its place', async () => {
    mocks.getStatus.mockReset();
    mocks.getStatus.mockResolvedValueOnce({
      billingStatus: 'ACTIVE',
      planCode: 'PRO',
      billingInterval: 'MONTHLY',
      paddleEnv: 'sandbox',
      currentPeriodEndsAt: '2026-06-01T00:00:00Z',
      lastEventId: 'evt_active',
      lastEventOccurredAt: null,
    });

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    const cancelButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="manage-action-cancel"]',
    );
    await act(async () => {
      cancelButton?.click();
      await flushReactWork();
    });

    expect(
      container.querySelector('[data-testid="manage-notice"]'),
    ).not.toBeNull();

    const close = container.querySelector<HTMLButtonElement>(
      '[data-testid="manage-notice-close"]',
    );
    await act(async () => {
      close?.click();
      await flushReactWork();
    });

    expect(
      container.querySelector('[data-testid="manage-notice"]'),
    ).toBeNull();

    const changePlanButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="manage-action-change-plan"]',
    );
    await act(async () => {
      changePlanButton?.click();
      await flushReactWork();
    });

    const notice = container.querySelector('[data-testid="manage-notice"]');
    expect(notice?.getAttribute('data-action')).toBe('changePlan');
  });

  it('uses the reason query param to render the right activation banner before the status fetch lands', async () => {
    mocks.searchParams = new URLSearchParams('reason=pending');
    let resolveStatus!: (value: unknown) => void;
    mocks.getStatus.mockReset();
    mocks.getStatus.mockReturnValueOnce(
      new Promise((res) => {
        resolveStatus = res;
      }),
    );

    await act(async () => {
      root.render(<BillingPage />);
    });

    const panel = container.querySelector('[data-testid="billing-activation-panel"]');
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute('data-variant')).toBe('pending');

    await act(async () => {
      resolveStatus(emptyStatus());
      await flushReactWork();
    });
  });

  it('uses signup query params to preselect annual billing and show selected plan copy', async () => {
    mocks.searchParams = new URLSearchParams(
      'plan=BUSINESS&interval=ANNUAL&from=signup',
    );
    mocks.createCheckout.mockResolvedValueOnce({ transactionId: 'txn_123' });
    mocks.openCheckout.mockResolvedValueOnce(undefined);

    await act(async () => {
      root.render(<BillingPage />);
    });

    expect(container.textContent).toContain('Selected from signup');
    expect(container.textContent).toContain('You can change it before checkout.');
    expect(container.textContent).toContain('Selected plan');

    const businessCheckout = findButtonByText(container, 'Checkout Business');
    expect(businessCheckout).toBeDefined();

    await act(async () => {
      businessCheckout?.click();
      await flushReactWork();
    });

    expect(mocks.createCheckout).toHaveBeenCalledWith({
      planCode: 'BUSINESS',
      billingInterval: 'ANNUAL',
    });
    expect(mocks.openCheckout).toHaveBeenCalledTimes(1);
  });

  it('shows missing-subscription headline and a "See plans" affordance when no subscription exists', async () => {
    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    const statusPanel = container.querySelector(
      '[data-testid="subscription-status-panel"]',
    );
    expect(statusPanel?.getAttribute('data-kind')).toBe('missing');
    expect(statusPanel?.textContent).toContain(
      'Choose a plan to start your 14-day trial.',
    );
    expect(
      container.querySelector('[data-testid="status-see-plans"]'),
    ).not.toBeNull();
    // Plans section anchor must exist on the page so the "See plans"
    // button can scroll to it.
    expect(
      container.querySelector('[data-testid="plans-section"]'),
    ).not.toBeNull();
  });

  it('renders real status-error translation copy instead of raw keys', async () => {
    mocks.getStatus.mockReset();
    mocks.getStatus.mockRejectedValue(new Error('fetch broke'));

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    const statusPanel = container.querySelector(
      '[data-testid="subscription-status-panel"]',
    );
    expect(statusPanel?.textContent).toContain(
      "We couldn't verify your subscription status.",
    );
    expect(statusPanel?.textContent).toContain(
      'Refresh the page or try again. If the issue continues, contact support.',
    );
    expect(statusPanel?.textContent).not.toContain('status.headline.error');
    expect(statusPanel?.textContent).not.toContain('status.body.error');
  });

  it('treats NO_SUBSCRIPTION as missing, not inactive or configured', async () => {
    mocks.getStatus.mockReset();
    mocks.getStatus.mockResolvedValueOnce({
      billingStatus: 'NO_SUBSCRIPTION',
      planCode: null,
      billingInterval: null,
      paddleEnv: null,
      currentPeriodEndsAt: null,
      lastEventId: null,
      lastEventOccurredAt: null,
    });

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    const activationPanel = container.querySelector(
      '[data-testid="billing-activation-panel"]',
    );
    expect(activationPanel).not.toBeNull();
    expect(activationPanel?.getAttribute('data-variant')).toBe('missing');
    expect(activationPanel?.textContent).toContain('activation.required.title');
    expect(activationPanel?.textContent).toContain('activation.required.cta');

    const statusPanel = container.querySelector(
      '[data-testid="subscription-status-panel"]',
    );
    expect(statusPanel?.getAttribute('data-kind')).toBe('missing');
    expect(statusPanel?.textContent).toContain('No subscription yet');
    expect(statusPanel?.textContent).toContain(
      'Start checkout to configure billing.',
    );
    expect(statusPanel?.textContent).toContain(
      'Choose a plan to start your 14-day trial.',
    );
    expect(statusPanel?.textContent).not.toContain(
      'Local billing state confirmed by Paddle webhooks.',
    );
    expect(statusPanel?.textContent).not.toContain('Inactive');
    expect(
      container.querySelector('[data-testid="status-see-plans"]'),
    ).not.toBeNull();
  });

  it('disables inline retry while checkout is busy and ignores repeated clicks', async () => {
    mocks.getStatus.mockReset();
    mocks.getStatus.mockResolvedValueOnce({
      billingStatus: 'CHECKOUT_PENDING',
      planCode: 'BUSINESS',
      billingInterval: 'ANNUAL',
      paddleEnv: 'sandbox',
      currentPeriodEndsAt: null,
      lastEventId: null,
      lastEventOccurredAt: null,
    });
    mocks.createCheckout.mockReturnValueOnce(new Promise(() => {}));

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    const retryButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="status-retry-checkout"]',
    );
    expect(retryButton).not.toBeNull();

    await act(async () => {
      retryButton?.click();
      await flushReactWork();
    });

    expect(retryButton?.disabled).toBe(true);

    await act(async () => {
      retryButton?.click();
      retryButton?.click();
      await flushReactWork();
    });

    expect(mocks.createCheckout).toHaveBeenCalledTimes(1);
  });
});

describe('billing locale coverage', () => {
  it('defines real status-error copy in EN and ES locales', () => {
    expect(enBilling['status.headline.error']).toBe(
      "We couldn't verify your subscription status.",
    );
    expect(enBilling['status.body.error']).toBe(
      'Refresh the page or try again. If the issue continues, contact support.',
    );
    expect(esBilling['status.headline.error']).toBe(
      'No pudimos verificar el estado de tu suscripción.',
    );
    expect(esBilling['status.body.error']).toBe(
      'Actualiza la página o inténtalo de nuevo. Si el problema continúa, contacta a soporte.',
    );
  });

  it('uses beta billing-help copy instead of promising self-service cancellation', () => {
    expect(enBilling['card.cta.hint']).toBe(
      'Subscription management is being finalized for beta. Contact support if you need billing help.',
    );
    expect(esBilling['card.cta.hint']).toBe(
      'La administración de suscripción se está terminando para la beta. Contacta a soporte si necesitas ayuda con facturación.',
    );
    expect(enBilling['card.cta.hint']).not.toMatch(/cancel any time/i);
    expect(esBilling['card.cta.hint']).not.toMatch(/cancel[aá]s cuando quieras/i);
  });
});
