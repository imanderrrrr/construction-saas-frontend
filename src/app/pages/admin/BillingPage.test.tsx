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
import { BETA_EMAIL } from '../../components/landing/contact';

const mocks = vi.hoisted(() => ({
  changeLanguage: vi.fn(),
  changePlan: vi.fn(),
  createCheckout: vi.fn(),
  getStatus: vi.fn(),
  navigate: vi.fn(),
  searchParams: new URLSearchParams(),
}));

// Mock t() so the assertions can match either explicit copy (for the
// keys we care about reading in the DOM) or the raw key (so we never
// have to keep two copies of every translation in sync with the test).
const EXPLICIT_BILLING_KEYS: Record<
  string,
  string | ((options?: Record<string, string>) => string)
> = {
  'page.title': 'Subscription',
  'page.subtitle':
    'Review the status of your BuildTrack subscription. Any plan change is arranged with you by email.',
  'contact.subject': 'My BuildTrack subscription',
  'status.title': 'Current subscription',
  'status.configured': 'Local billing state confirmed by Paddle webhooks.',
  'status.refresh': 'Refresh status',
  'status.refreshing': 'Refreshing status',
  'status.empty.title': 'No subscription yet',
  'status.empty.body': "Email us and we'll set your subscription up.",
  'status.trialFlag': 'On trial',
  'status.paddleEnv.sandbox': 'Sandbox',
  'status.paddleEnv.live': 'Live',
  'status.field.status': 'Status',
  'status.field.plan': 'Plan',
  'status.field.interval': 'Interval',
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
  'status.headline.missing': 'No subscription yet headline',
  'status.headline.expired': 'Expired headline',
  'status.headline.error': "We couldn't verify your subscription status.",
  'status.body.active': 'You have full access to BuildTrack.',
  'status.body.missing': "You don't have an active subscription yet.",
  'status.body.expired': 'Your access is paused. Email us and we reactivate it.',
  'status.body.error':
    'Refresh the page or try again. If the issue continues, contact support.',
  'status.badge.active': 'Active',
  'status.badge.missing': 'No subscription',
  'status.badge.expired': 'Expired',
  'status.badge.error': 'Status error',
  'status.cta.contact': 'Email us',
  'status.cta.contactHint': 'We reply the same business day.',
  'activation.signOut': 'Sign out',
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

vi.mock('../../services/auth', () => ({
  AuthService: {
    logout: vi.fn().mockResolvedValue(undefined),
  },
}));

// services/billing is importActual'd below and pulls in lib/api, which boots
// the real i18n singleton — stub it so the react-i18next mock above stays the
// only i18n in this file. BillingService itself is replaced wholesale, so
// nothing here ever reaches the wire.
vi.mock('../../lib/api', () => ({
  api: vi.fn(),
}));

// changePlan / createCheckout are mocked even though the page no longer
// imports them: the tests below assert the page never reaches for either.
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
      'Review the status of your BuildTrack subscription. Any plan change is arranged with you by email.',
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
});

// BuildTrack is sold demo-led: a plan is quoted per customer on a call and
// the beta is activated by hand, so this page must never quote an amount or
// take money. These are the regression tests for that decision.
describe('BillingPage sells nothing', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.changePlan.mockReset();
    mocks.createCheckout.mockReset();
    mocks.getStatus.mockReset();
    mocks.getStatus.mockResolvedValue(emptyStatus());
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

  const STATES: [label: string, status: Record<string, unknown>][] = [
    ['no subscription', emptyStatus()],
    ['active', activeStatus()],
    ['expired', activeStatus({ billingStatus: 'EXPIRED' })],
    ['past due', activeStatus({ billingStatus: 'PAST_DUE' })],
    ['checkout pending', activeStatus({ billingStatus: 'CHECKOUT_PENDING' })],
  ];

  it.each(STATES)('quotes no price when the tenant is %s', async (_label, status) => {
    mocks.getStatus.mockResolvedValueOnce(status);

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    expect(container.textContent).not.toMatch(/\$\s?\d/);
  });

  it.each(STATES)('offers the contact mailto when the tenant is %s', async (_label, status) => {
    mocks.getStatus.mockResolvedValueOnce(status);

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    const cta = container.querySelector<HTMLAnchorElement>(
      '[data-testid="status-contact-cta"]',
    );
    expect(cta).not.toBeNull();
    // Reuses the shared public-site inbox + subject helper.
    expect(cta?.getAttribute('href')).toBe(
      `mailto:${BETA_EMAIL}?subject=My%20BuildTrack%20subscription`,
    );
  });

  it('renders no plan cards and no plans grid', async () => {
    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    expect(container.querySelector('[data-testid="plans-grid"]')).toBeNull();
    expect(container.querySelector('[data-testid="plans-section"]')).toBeNull();
    expect(container.querySelectorAll('[data-testid^="plan-card-"]')).toHaveLength(
      0,
    );
  });

  it('never starts a checkout or a plan change, in any state', async () => {
    for (const [, status] of STATES) {
      mocks.getStatus.mockResolvedValueOnce(status);

      await act(async () => {
        root.render(<BillingPage />);
        await flushReactWork();
      });

      // Click every button — those are the only elements carrying a
      // handler, so between them and the href assertions above nothing on
      // this page can reach Paddle. Sign-out is skipped: it deliberately
      // does a full document navigation, which jsdom can't follow.
      const buttons = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button'),
      ).filter((b) => !b.textContent?.includes('Sign out'));

      for (const button of buttons) {
        await act(async () => {
          button.click();
          await flushReactWork();
        });
      }
    }

    expect(mocks.createCheckout).not.toHaveBeenCalled();
    expect(mocks.changePlan).not.toHaveBeenCalled();
  });

  it('ignores a plan=/interval= intent smuggled in via the query string', async () => {
    mocks.searchParams = new URLSearchParams(
      'plan=BUSINESS&interval=ANNUAL&from=signup',
    );

    await act(async () => {
      root.render(<BillingPage />);
      await flushReactWork();
    });

    expect(container.textContent).not.toMatch(/\$\s?\d/);
    expect(container.querySelector('[data-testid="plans-grid"]')).toBeNull();
    expect(mocks.createCheckout).not.toHaveBeenCalled();
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

  it('defines the contact CTA and its mail subject in both locales', () => {
    for (const bundle of [enBilling, esBilling] as Record<string, string>[]) {
      expect(bundle['status.cta.contact']).toBeTruthy();
      expect(bundle['status.cta.contactHint']).toBeTruthy();
      expect(bundle['contact.subject']).toBeTruthy();
    }
  });

  it('keeps no copy for the retired checkout / change-plan flows', () => {
    // These keys backed the Paddle checkout and the self-serve change-plan
    // grid. If one comes back, so did a way to charge from this page.
    const retired = /^(card\.|plans\.|changePlan\.|error\.|selectedFromSignup\.|success\.|cancel\.|status\.cta\.(retry|choosePlan|reactivate|upgrade))/;
    for (const bundle of [enBilling, esBilling] as Record<string, string>[]) {
      expect(Object.keys(bundle).filter((k) => retired.test(k))).toEqual([]);
    }
  });
});
