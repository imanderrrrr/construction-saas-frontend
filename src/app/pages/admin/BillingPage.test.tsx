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

const mocks = vi.hoisted(() => ({
  changeLanguage: vi.fn(),
  createCheckout: vi.fn(),
  getStatus: vi.fn(),
  navigate: vi.fn(),
  openCheckout: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: (namespace?: string) => ({
    i18n: {
      language: 'en',
      changeLanguage: mocks.changeLanguage,
    },
    t: (key: string, options?: Record<string, string>) => {
      if (namespace === 'billing' && key === 'error.title') {
        return 'Billing error';
      }
      if (namespace === 'billing' && key === 'error.missingToken') {
        return 'Missing Paddle client token.';
      }
      if (namespace === 'billing' && key === 'error.generic') {
        return 'Generic billing error.';
      }
      if (namespace === 'billing' && key === 'error.network') {
        return 'Network billing error.';
      }
      if (namespace === 'billing' && key === 'card.cta.checkout') {
        return `Checkout ${options?.plan ?? ''}`.trim();
      }
      if (namespace === 'billing' && key === 'card.cta.processing') {
        return 'Processing';
      }
      if (namespace === 'billing' && key === 'selectedFromSignup.title') {
        return 'Selected from signup';
      }
      if (namespace === 'billing' && key === 'selectedFromSignup.body') {
        return 'You can change it before checkout.';
      }
      if (namespace === 'billing' && key === 'selectedFromSignup.badge') {
        return 'Selected plan';
      }
      if (namespace === 'billing' && key === 'status.title') {
        return 'Current subscription';
      }
      if (namespace === 'billing' && key === 'status.refresh') {
        return 'Refresh status';
      }
      if (namespace === 'billing' && key === 'status.refreshing') {
        return 'Refreshing status';
      }
      if (namespace === 'billing' && key === 'status.empty.title') {
        return 'No subscription yet';
      }
      if (namespace === 'billing' && key === 'status.empty.body') {
        return 'Start checkout to configure billing.';
      }
      if (namespace === 'billing' && key === 'status.field.status') {
        return 'Status';
      }
      if (namespace === 'billing' && key === 'status.field.plan') {
        return 'Plan';
      }
      if (namespace === 'billing' && key === 'status.field.interval') {
        return 'Interval';
      }
      if (namespace === 'billing' && key === 'status.field.paddleEnv') {
        return 'Paddle environment';
      }
      if (namespace === 'billing' && key === 'status.field.lastEvent') {
        return 'Last event';
      }
      if (namespace === 'billing' && key === 'status.field.periodEnds') {
        return 'Current period ends';
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
      button.textContent?.includes('Checkout') ?? false,
  );
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

    const refreshButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Refresh status'),
    );
    expect(refreshButton).toBeDefined();

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

    const [, businessCheckout] = checkoutButtons(container);
    expect(businessCheckout).toBeDefined();

    await act(async () => {
      businessCheckout.click();
      await flushReactWork();
    });

    expect(mocks.createCheckout).toHaveBeenCalledWith({
      planCode: 'BUSINESS',
      billingInterval: 'ANNUAL',
    });
    expect(mocks.openCheckout).toHaveBeenCalledTimes(1);
  });
});
