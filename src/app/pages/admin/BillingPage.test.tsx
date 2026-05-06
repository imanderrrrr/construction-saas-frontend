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
  navigate: vi.fn(),
  openCheckout: vi.fn(),
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

describe('BillingPage checkout errors', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.changeLanguage.mockReset();
    mocks.createCheckout.mockReset();
    mocks.navigate.mockReset();
    mocks.openCheckout.mockReset();

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
});
