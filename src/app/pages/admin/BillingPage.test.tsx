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
  changePlan: vi.fn(),
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
    `Subscribe to ${options?.plan ?? ''}`.trim(),
  'card.cta.startCheckout': (options) =>
    `Start checkout for ${options?.plan ?? ''}`.trim(),
  'card.cta.retryCheckout': (options) =>
    `Retry ${options?.plan ?? ''} checkout`.trim(),
  'card.cta.changePlan': 'Change to this plan',
  'card.cta.currentPlan': 'Current plan',
  'card.cta.processing': 'Processing',
  'card.cta.changingPlan': 'Requesting change',
  'card.cta.hint': 'Secure payment by Paddle.',
  'card.cta.hintCurrent': "You're already on this plan.",
  'card.cta.hintChange': 'Change applied once Paddle confirms.',
  'card.badge.current': 'Current plan badge',
  'card.badge.upgrade': 'Upgrade',
  'card.everythingInPro': 'Everything in Pro, plus:',
  'selectedFromSignup.title': 'Selected from signup',
  'selectedFromSignup.body': 'You can change it before checkout.',
  'selectedFromSignup.badge': 'Selected plan',
  'page.title': 'Subscription',
  'page.subtitle':
    'Manage your BuildTrack plan, review billing status, and switch plans whenever you need.',
  'status.title': 'Current subscription',
  'status.configured': 'Local billing state confirmed by Paddle webhooks.',
  'status.refresh': 'Refresh status',
  'status.refreshing': 'Refreshing status',
  'status.empty.title': 'No subscription yet',
  'status.empty.body': 'Start checkout to configure billing.',
  'status.trialFlag': 'On trial',
  'status.paddleEnv.sandbox': 'Sandbox',
  'status.paddleEnv.live': 'Live',
  'status.field.status': 'Status',
  'status.field.plan': 'Plan',
  'status.field.interval': 'Interval',
  'status.field.paddleEnv': 'Paddle environment',
  'status.field.lastEvent': 'Last event',
  'status.field.lastEventAt': 'Last event (when)',
  'status.field.periodStarts': 'Period starts',
  'status.field.periodEnds': 'Current period ends',
  'status.field.trialStarts': 'Trial starts',
  'status.field.trialEnds': 'Trial ends',
  'status.field.updatedAt': 'Last updated',
  'status.cancelAtPeriodEnd.title': 'Cancellation scheduled',
  'status.cancelAtPeriodEnd.body':
    'Your subscription is scheduled to cancel at the end of the period.',
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
  'changePlan.blockedTitle': "Plan changes aren't available right now",
  'changePlan.blocked.default': "Changing plans isn't available right now.",
  'changePlan.blocked.NO_PADDLE_SUBSCRIPTION':
    "We couldn't find an active subscription on file.",
  'changePlan.blocked.CANCEL_AT_PERIOD_END':
    'Your subscription is already scheduled to cancel at the end of the period.',
  'changePlan.blocked.BILLING_STATUS_NOT_ALLOWED':
    "Your current status doesn't allow plan changes.",
  'changePlan.blocked.PLAN_NOT_RESOLVED':
    "We couldn't resolve your current plan yet. Refresh the status or contact support.",
  'changePlan.blocked.NO_BILLING_ACCOUNT':
    "We couldn't find billing information for this workspace.",
  'changePlan.success.title': 'Plan change requested',
  'changePlan.success.body':
    'Change requested. Waiting for Paddle confirmation.',
  'changePlan.error.title': "We couldn't change the plan",
  'changePlan.error.generic':
    'Something went wrong requesting the plan change.',
  'plans.title': 'Available plans',
  'plans.subtitleDefault': 'Pick the plan that fits your operation.',
  'plans.subtitleActive':
    "Pick a new plan and we'll handle the change with Paddle.",
  'toggle.monthly': 'Monthly',
  'toggle.annual': 'Annual',
};

vi.mock('react-i18next', () => ({
  useTranslation: (namespace?: string) => ({
    i18n: {
      language: 'en',
      changeLanguage: mocks.changeLanguage,
    },
    t: (
      key: string,
      options?: Record<string, string> & { defaultValue?: string },
    ) => {
      if (namespace === 'billing' && key in EXPLICIT_BILLING_KEYS) {
        const value = EXPLICIT_BILLING_KEYS[key];
        return typeof value === 'function' ? value(options) : value;
      }
      if (namespace === 'pricing') {
        if (key.endsWith('.name')) {
          return key.includes('.pro.') ? 'Pro' : 'Business';
        }
        if (key.endsWith('.priceMonthly')) {
          return key.includes('.pro.') ? '$399' : '$599';
        }
        if (key.endsWith('.priceAnnualPerMonth')) {
          return key.includes('.pro.') ? '$333' : '$499';
        }
        if (key.endsWith('.priceAnnualTotal')) {
          return key.includes('.pro.') ? '$3,990' : '$5,990';
        }
        if (key.endsWith('.saving')) {
          return key.includes('.pro.') ? '$798' : '$1,198';
        }
        if (key === 'save') {
          return `Save ${options?.amount ?? ''}/year`;
        }
        if (key === 'perMonth') {
          return '/mo';
        }
        if (key === 'billing.billedAnnually') {
          return 'billed annually';
        }
        if (key === 'plans.business.badge') {
          return 'Most popular';
        }
      }

      if (options && 'defaultValue' in options && options.defaultValue) {
        return options.defaultValue;
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
      changePlan: mocks.changePlan,
      createCheckout: mocks.createCheckout,
      getStatus: mocks.getStatus,
    },
  };
});

import { BillingPage } from './BillingPage';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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
    currentPeriodStartsAt: null,
    currentPeriodEndsAt: null,
    trialStartsAt: null,
    trialEndsAt: null,
    isTrialing: false,
    cancelAtPeriodEnd: false,
    updatedAt: null,
    hasPaddleSubscription: false,
    changePlanAllowed: false,
    changePlanBlockedReason: null,
    lastEventId: null,
    lastEventOccurredAt: null,
  };
}

function activeStatus(overrides: Record<string, unknown> = {}) {
  return {
    billingStatus: 'ACTIVE',
    planCode: 'PRO',
    billingInterval: 'MONTHLY',
    paddleEnv: 'sandbox',
    currentPeriodStartsAt: '2026-05-01T00:00:00Z',
    currentPeriodEndsAt: '2026-06-01T00:00:00Z',
    trialStartsAt: null,
    trialEndsAt: null,
    isTrialing: false,
    cancelAtPeriodEnd: false,
    updatedAt: '2026-05-10T00:00:00Z',
    hasPaddleSubscription: true,
    changePlanAllowed: true,
    changePlanBlockedReason: null,
    lastEventId: 'evt_active',
    lastEventOccurredAt: '2026-05-01T12:30:00Z',
    ...overrides,
  };
}

function planCard(
  container: HTMLElement,
  plan: 'pro' | 'business',
  interval: 'monthly' | 'annual',
): HTMLElement | null {
  return container.querySelector<HTMLElement>(
    `[data-testid="plan-card-${plan}-${interval}"]`,
  );
}

function planCardCta(
  container: HTMLElement,
  plan: 'pro' | 'business',
  interval: 'monthly' | 'annual',
): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>(
    `[data-testid="plan-card-${plan}-${interval}-cta"]`,
  );
}

describe('BillingPage subscription panel', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.changeLanguage.mockReset();
    mocks.changePlan.mockReset();
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

  it('renders the subscription page title and subtitle', async () => {
    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    const h1 = container.querySelector('h1');
    expect(h1?.textContent).toBe('Subscription');
    expect(container.textContent).toContain(
      'Manage your BuildTrack plan, review billing status, and switch plans whenever you need.',
    );
  });

  it('exposes a top-level refresh button that calls getStatus again', async () => {
    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    expect(mocks.getStatus).toHaveBeenCalledTimes(1);

    const top = container.querySelector<HTMLButtonElement>(
      '[data-testid="status-refresh-button-top"]',
    );
    expect(top).not.toBeNull();

    await act(async () => {
      top?.click();
      await flushReactWork();
    });

    expect(mocks.getStatus).toHaveBeenCalledTimes(2);
    expect(mocks.getStatus).toHaveBeenLastCalledWith();
  });

  it('requests billing status when the page mounts without sending tenant fields', async () => {
    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    expect(mocks.getStatus).toHaveBeenCalledTimes(1);
    expect(mocks.getStatus).toHaveBeenCalledWith();
  });

  it('renders the extended status fields (interval, period start/end, paddle env, updatedAt) when subscription is ACTIVE', async () => {
    mocks.getStatus.mockResolvedValueOnce(
      activeStatus({
        planCode: 'PRO',
        billingInterval: 'ANNUAL',
      }),
    );

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    const panel = container.querySelector(
      '[data-testid="subscription-status-panel"]',
    );
    expect(panel).not.toBeNull();
    expect(panel?.textContent).toContain('Current subscription');
    expect(panel?.textContent).toContain('PRO');
    expect(panel?.textContent).toContain('Annual');

    expect(
      container.querySelector('[data-testid="status-field-period-starts"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="status-field-period-ends"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="status-field-updated-at"]'),
    ).not.toBeNull();

    const paddleBadge = container.querySelector(
      '[data-testid="status-paddle-env-badge"]',
    );
    expect(paddleBadge?.textContent).toContain('Sandbox');
  });

  it('renders trial date fields when the subscription is TRIALING with trial dates', async () => {
    mocks.getStatus.mockResolvedValueOnce(
      activeStatus({
        billingStatus: 'TRIALING',
        planCode: 'BUSINESS',
        billingInterval: 'MONTHLY',
        isTrialing: true,
        trialStartsAt: '2026-05-01T00:00:00Z',
        trialEndsAt: '2026-05-15T00:00:00Z',
      }),
    );

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    expect(
      container.querySelector('[data-testid="status-field-trial-starts"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="status-field-trial-ends"]'),
    ).not.toBeNull();
  });

  it('shows the cancel-at-period-end notice when cancelAtPeriodEnd is true', async () => {
    mocks.getStatus.mockResolvedValueOnce(
      activeStatus({
        cancelAtPeriodEnd: true,
        // The backend also tends to block change-plan in this state.
        changePlanAllowed: false,
        changePlanBlockedReason: 'CANCEL_AT_PERIOD_END',
      }),
    );

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    const panel = container.querySelector(
      '[data-testid="subscription-status-panel"]',
    );
    expect(panel?.getAttribute('data-cancel-at-period-end')).toBe('true');

    const notice = container.querySelector('[data-testid="status-cancel-notice"]');
    expect(notice).not.toBeNull();
  });

  it('renders all four plan cards (PRO MONTHLY, PRO ANNUAL, BUSINESS MONTHLY, BUSINESS ANNUAL)', async () => {
    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    expect(planCard(container, 'pro', 'monthly')).not.toBeNull();
    expect(planCard(container, 'pro', 'annual')).not.toBeNull();
    expect(planCard(container, 'business', 'monthly')).not.toBeNull();
    expect(planCard(container, 'business', 'annual')).not.toBeNull();
  });

  it('shows the official BuildTrack prices on each plan card', async () => {
    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    expect(planCard(container, 'pro', 'monthly')?.textContent).toContain('$399');
    expect(planCard(container, 'pro', 'annual')?.textContent).toContain('$333');
    expect(planCard(container, 'pro', 'annual')?.textContent).toContain('$3,990');
    expect(planCard(container, 'business', 'monthly')?.textContent).toContain(
      '$599',
    );
    expect(planCard(container, 'business', 'annual')?.textContent).toContain('$499');
    expect(planCard(container, 'business', 'annual')?.textContent).toContain(
      '$5,990',
    );
    // Annual savings copy
    expect(planCard(container, 'pro', 'annual')?.textContent).toContain('$798');
    expect(planCard(container, 'business', 'annual')?.textContent).toContain(
      '$1,198',
    );
  });

  it('marks ONLY the exact (planCode + billingInterval) pair as current — PRO MONTHLY does not mark PRO ANNUAL', async () => {
    mocks.getStatus.mockResolvedValueOnce(
      activeStatus({
        planCode: 'PRO',
        billingInterval: 'MONTHLY',
      }),
    );

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    const proMonthly = planCard(container, 'pro', 'monthly');
    const proAnnual = planCard(container, 'pro', 'annual');
    const bizMonthly = planCard(container, 'business', 'monthly');
    const bizAnnual = planCard(container, 'business', 'annual');

    expect(proMonthly?.getAttribute('data-current')).toBe('true');
    expect(proAnnual?.getAttribute('data-current')).toBe('false');
    expect(bizMonthly?.getAttribute('data-current')).toBe('false');
    expect(bizAnnual?.getAttribute('data-current')).toBe('false');

    // The current-plan badge appears only on the current card.
    expect(
      container.querySelector('[data-testid="plan-card-pro-monthly-current-badge"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="plan-card-pro-annual-current-badge"]'),
    ).toBeNull();
  });

  it('disables the CTA of the current plan and enables CTAs of the other plans', async () => {
    mocks.getStatus.mockResolvedValueOnce(
      activeStatus({
        planCode: 'BUSINESS',
        billingInterval: 'ANNUAL',
      }),
    );

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    const currentCta = planCardCta(container, 'business', 'annual');
    expect(currentCta?.disabled).toBe(true);
    expect(currentCta?.textContent).toContain('Current plan');

    expect(planCardCta(container, 'pro', 'monthly')?.disabled).toBe(false);
    expect(planCardCta(container, 'pro', 'annual')?.disabled).toBe(false);
    expect(planCardCta(container, 'business', 'monthly')?.disabled).toBe(false);
  });

  it('clicking a non-current plan calls changePlan with ONLY { planCode, billingInterval } — no tenantId, priceId, amount or currency', async () => {
    mocks.getStatus.mockResolvedValueOnce(
      activeStatus({
        planCode: 'PRO',
        billingInterval: 'MONTHLY',
      }),
    );
    mocks.changePlan.mockResolvedValueOnce({ accepted: true });

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    const cta = planCardCta(container, 'business', 'annual');
    expect(cta).not.toBeNull();
    expect(cta?.textContent).toContain('Change to this plan');

    await act(async () => {
      cta?.click();
      await flushReactWork();
    });

    expect(mocks.changePlan).toHaveBeenCalledTimes(1);
    expect(mocks.changePlan).toHaveBeenCalledWith({
      planCode: 'BUSINESS',
      billingInterval: 'ANNUAL',
    });

    const payload = mocks.changePlan.mock.calls[0][0];
    expect(Object.keys(payload).sort()).toEqual(
      ['billingInterval', 'planCode'].sort(),
    );
    expect(payload).not.toHaveProperty('tenantId');
    expect(payload).not.toHaveProperty('priceId');
    expect(payload).not.toHaveProperty('amount');
    expect(payload).not.toHaveProperty('currency');
    expect(payload).not.toHaveProperty('paddleSubscriptionId');
    expect(payload).not.toHaveProperty('paddleCustomerId');

    // Checkout flow must NOT be triggered when we already have a subscription.
    expect(mocks.createCheckout).not.toHaveBeenCalled();
    expect(mocks.openCheckout).not.toHaveBeenCalled();
  });

  it('changing to a different INTERVAL of the SAME plan also calls change-plan (PRO MONTHLY → PRO ANNUAL)', async () => {
    mocks.getStatus.mockResolvedValueOnce(
      activeStatus({
        planCode: 'PRO',
        billingInterval: 'MONTHLY',
      }),
    );
    mocks.changePlan.mockResolvedValueOnce({ accepted: true });

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    const cta = planCardCta(container, 'pro', 'annual');
    expect(cta?.disabled).toBe(false);

    await act(async () => {
      cta?.click();
      await flushReactWork();
    });

    expect(mocks.changePlan).toHaveBeenCalledWith({
      planCode: 'PRO',
      billingInterval: 'ANNUAL',
    });
  });

  it('disables all plan CTAs and shows a blocked banner when changePlanAllowed = false', async () => {
    mocks.getStatus.mockResolvedValueOnce(
      activeStatus({
        changePlanAllowed: false,
        changePlanBlockedReason: 'BILLING_STATUS_NOT_ALLOWED',
      }),
    );

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    expect(planCardCta(container, 'pro', 'monthly')?.disabled).toBe(true);
    expect(planCardCta(container, 'pro', 'annual')?.disabled).toBe(true);
    expect(planCardCta(container, 'business', 'monthly')?.disabled).toBe(true);
    expect(planCardCta(container, 'business', 'annual')?.disabled).toBe(true);

    const banner = container.querySelector(
      '[data-testid="change-plan-blocked-banner"]',
    );
    expect(banner).not.toBeNull();
    expect(banner?.getAttribute('data-reason')).toBe(
      'BILLING_STATUS_NOT_ALLOWED',
    );
    expect(banner?.textContent).toContain(
      "Your current status doesn't allow plan changes.",
    );

    // No backend mutation should have been triggered.
    expect(mocks.changePlan).not.toHaveBeenCalled();
  });

  it('renders the PLAN_NOT_RESOLVED reason copy when the backend blocks change-plan for that reason', async () => {
    mocks.getStatus.mockResolvedValueOnce(
      activeStatus({
        changePlanAllowed: false,
        changePlanBlockedReason: 'PLAN_NOT_RESOLVED',
      }),
    );

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    const banner = container.querySelector(
      '[data-testid="change-plan-blocked-banner"]',
    );
    expect(banner?.getAttribute('data-reason')).toBe('PLAN_NOT_RESOLVED');
    expect(banner?.textContent).toContain(
      "We couldn't resolve your current plan yet. Refresh the status or contact support.",
    );
  });

  it('shows only the loading spinner on the plan that is being changed, not on the others', async () => {
    mocks.getStatus.mockResolvedValueOnce(
      activeStatus({
        planCode: 'PRO',
        billingInterval: 'MONTHLY',
      }),
    );
    // Keep changePlan pending so we can observe the in-flight UI state.
    mocks.changePlan.mockReturnValueOnce(new Promise(() => {}));

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    const targetCta = planCardCta(container, 'business', 'monthly');
    await act(async () => {
      targetCta?.click();
      await flushReactWork();
    });

    expect(targetCta?.getAttribute('aria-busy')).toBe('true');
    expect(targetCta?.disabled).toBe(true);
    expect(targetCta?.textContent).toContain('Requesting change');

    // The other non-current cards must be disabled too (single in-flight)
    // — but they must NOT show the spinner copy.
    const otherCta = planCardCta(container, 'business', 'annual');
    expect(otherCta?.disabled).toBe(true);
    expect(otherCta?.textContent).not.toContain('Requesting change');

    // Repeated clicks on the same CTA must not fire another request.
    await act(async () => {
      targetCta?.click();
      targetCta?.click();
      await flushReactWork();
    });
    expect(mocks.changePlan).toHaveBeenCalledTimes(1);
  });

  it('shows a friendly error banner without crashing when change-plan rejects', async () => {
    mocks.getStatus.mockResolvedValueOnce(
      activeStatus({
        planCode: 'PRO',
        billingInterval: 'MONTHLY',
      }),
    );
    mocks.changePlan.mockRejectedValueOnce(new Error('boom'));

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    const cta = planCardCta(container, 'business', 'monthly');
    await act(async () => {
      cta?.click();
      await flushReactWork();
    });

    const errorBanner = container.querySelector(
      '[data-testid="billing-error-banner"]',
    );
    expect(errorBanner).not.toBeNull();
    expect(errorBanner?.textContent).toContain(
      "We couldn't change the plan",
    );

    // The page is still alive and interactive.
    const refresh = container.querySelector(
      '[data-testid="status-refresh-button-top"]',
    );
    expect(refresh).not.toBeNull();
  });

  it('after success, shows the "change requested" banner and does NOT visually move the current plan until status is refreshed', async () => {
    // Initial status: PRO MONTHLY current.
    mocks.getStatus.mockResolvedValueOnce(
      activeStatus({
        planCode: 'PRO',
        billingInterval: 'MONTHLY',
      }),
    );
    mocks.changePlan.mockResolvedValueOnce({ accepted: true });

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    const cta = planCardCta(container, 'business', 'annual');
    await act(async () => {
      cta?.click();
      await flushReactWork();
    });

    // Success banner is visible.
    const successBanner = container.querySelector(
      '[data-testid="change-plan-success-banner"]',
    );
    expect(successBanner).not.toBeNull();
    expect(successBanner?.textContent).toContain('Plan change requested');

    // Current plan still PRO MONTHLY in the UI (no local optimistic swap).
    expect(planCard(container, 'pro', 'monthly')?.getAttribute('data-current')).toBe(
      'true',
    );
    expect(planCard(container, 'business', 'annual')?.getAttribute('data-current')).toBe(
      'false',
    );

    // Now the user hits refresh and the backend reports the new plan.
    mocks.getStatus.mockResolvedValueOnce(
      activeStatus({
        planCode: 'BUSINESS',
        billingInterval: 'ANNUAL',
      }),
    );

    const refresh = container.querySelector<HTMLButtonElement>(
      '[data-testid="status-refresh-button-top"]',
    );
    await act(async () => {
      refresh?.click();
      await flushReactWork();
    });

    expect(planCard(container, 'business', 'annual')?.getAttribute('data-current')).toBe(
      'true',
    );
    expect(planCard(container, 'pro', 'monthly')?.getAttribute('data-current')).toBe(
      'false',
    );

    // And the success banner is cleared on refresh.
    expect(
      container.querySelector('[data-testid="change-plan-success-banner"]'),
    ).toBeNull();
  });

  it('falls back to checkout (NOT change-plan) for tenants without a Paddle subscription', async () => {
    mocks.getStatus.mockResolvedValueOnce(
      emptyStatus(), // hasPaddleSubscription=false
    );
    mocks.createCheckout.mockResolvedValueOnce({ transactionId: 'txn_123' });
    mocks.openCheckout.mockResolvedValueOnce(undefined);

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    const cta = planCardCta(container, 'pro', 'annual');
    expect(cta?.textContent).toContain('Subscribe to Pro');

    await act(async () => {
      cta?.click();
      await flushReactWork();
    });

    expect(mocks.createCheckout).toHaveBeenCalledWith({
      planCode: 'PRO',
      billingInterval: 'ANNUAL',
    });
    expect(mocks.openCheckout).toHaveBeenCalledTimes(1);
    // Change-plan must NOT have been called.
    expect(mocks.changePlan).not.toHaveBeenCalled();
  });

  it('shows the activation banner for tenants with NO subscription', async () => {
    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    const panel = container.querySelector(
      '[data-testid="billing-activation-panel"]',
    );
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute('data-variant')).toBe('missing');
  });

  it('shows the status-error activation banner with role="alert" when the status fetch fails', async () => {
    mocks.getStatus.mockReset();
    mocks.getStatus.mockRejectedValue(new Error('fetch broke'));

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    const panel = container.querySelector(
      '[data-testid="billing-activation-panel"]',
    );
    expect(panel?.getAttribute('data-variant')).toBe('error');
    expect(panel?.getAttribute('role')).toBe('alert');
  });

  it('uses signup query params to preselect the plan and call checkout with that pair', async () => {
    mocks.searchParams = new URLSearchParams(
      'plan=BUSINESS&interval=ANNUAL&from=signup',
    );
    mocks.createCheckout.mockResolvedValueOnce({ transactionId: 'txn_123' });
    mocks.openCheckout.mockResolvedValueOnce(undefined);

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    expect(container.textContent).toContain('Selected from signup');

    const cta = planCardCta(container, 'business', 'annual');
    await act(async () => {
      cta?.click();
      await flushReactWork();
    });

    expect(mocks.createCheckout).toHaveBeenCalledWith({
      planCode: 'BUSINESS',
      billingInterval: 'ANNUAL',
    });
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

  it('defines change-plan blocked reasons in both EN and ES locales', () => {
    const reasons = [
      'NO_PADDLE_SUBSCRIPTION',
      'CANCEL_AT_PERIOD_END',
      'BILLING_STATUS_NOT_ALLOWED',
      'PLAN_NOT_RESOLVED',
      'NO_BILLING_ACCOUNT',
    ] as const;

    for (const reason of reasons) {
      const enKey = `changePlan.blocked.${reason}` as const;
      const esKey = `changePlan.blocked.${reason}` as const;
      expect(typeof (enBilling as Record<string, unknown>)[enKey]).toBe(
        'string',
      );
      expect(typeof (esBilling as Record<string, unknown>)[esKey]).toBe(
        'string',
      );
      expect((enBilling as Record<string, string>)[enKey].length).toBeGreaterThan(
        10,
      );
      expect((esBilling as Record<string, string>)[esKey].length).toBeGreaterThan(
        10,
      );
    }
  });

  it('defines change-plan success and error copy in both EN and ES locales', () => {
    expect(enBilling['changePlan.success.title']).toBeTruthy();
    expect(enBilling['changePlan.success.body']).toBeTruthy();
    expect(esBilling['changePlan.success.title']).toBeTruthy();
    expect(esBilling['changePlan.success.body']).toBeTruthy();

    // The success body must mention waiting for Paddle confirmation
    // (the whole point of NOT optimistically marking the plan as
    // changed in the UI). Both locales should keep that meaning.
    expect(esBilling['changePlan.success.body'].toLowerCase()).toContain(
      'paddle',
    );
    expect(enBilling['changePlan.success.body'].toLowerCase()).toContain(
      'paddle',
    );
  });

  it('defines the change-plan CTA in both locales', () => {
    expect(enBilling['card.cta.changePlan']).toBeTruthy();
    expect(esBilling['card.cta.changePlan']).toBeTruthy();
  });
});
