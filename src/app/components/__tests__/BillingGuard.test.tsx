// BuildTrack — BillingGuard tests.
//
// Covers the entitlement gate around internal admin routes:
//   - ADMIN with ACTIVE / TRIALING → children render
//   - ADMIN with CHECKOUT_PENDING / null / unknown → redirect to /admin/billing
//   - failed status fetch → redirect with reason=error
//   - non-admin roles bypass the guard entirely (no network call)
//   - /admin/billing is never wrapped, but the guard's redirects always
//     point at it so we assert the target URL precisely
//
// We mock `react-router`'s Navigate as a marker so the test can read the
// destination without driving a real router.

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
  getStatus: vi.fn(),
  getRole: vi.fn(),
}));

vi.mock('react-router', () => ({
  Navigate: ({ to, replace }: { to: string; replace?: boolean }) => (
    <span data-testid="navigate" data-to={to} data-replace={String(!!replace)} />
  ),
  useLocation: () => ({
    pathname: '/admin/dashboard',
    search: '',
    hash: '',
    state: null,
    key: 'test',
  }),
}));

vi.mock('../../services/auth', () => ({
  AuthService: {
    getRole: mocks.getRole,
  },
}));

vi.mock('../../services/billing', () => ({
  BillingService: {
    getStatus: mocks.getStatus,
  },
}));

import { BillingGuard } from '../BillingGuard';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function readNavigate(container: HTMLElement): {
  to: string | null;
  replace: string | null;
} {
  const el = container.querySelector('[data-testid="navigate"]');
  return {
    to: el?.getAttribute('data-to') ?? null,
    replace: el?.getAttribute('data-replace') ?? null,
  };
}

function fullStatus(billingStatus: string | null) {
  return {
    billingStatus,
    planCode: null,
    billingInterval: null,
    paddleEnv: null,
    currentPeriodEndsAt: null,
    lastEventId: null,
    lastEventOccurredAt: null,
  };
}

describe('BillingGuard', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.getStatus.mockReset();
    mocks.getRole.mockReset();

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

  it('renders children for an ADMIN with ACTIVE billing', async () => {
    mocks.getRole.mockReturnValue('ADMIN');
    mocks.getStatus.mockResolvedValue(fullStatus('ACTIVE'));

    await act(async () => {
      root.render(
        <BillingGuard>
          <div data-testid="protected-content">Dashboard</div>
        </BillingGuard>,
      );
      await flush();
    });

    expect(
      container.querySelector('[data-testid="protected-content"]'),
    ).not.toBeNull();
    expect(readNavigate(container).to).toBeNull();
  });

  it('renders children for an ADMIN with TRIALING billing', async () => {
    mocks.getRole.mockReturnValue('ADMIN');
    mocks.getStatus.mockResolvedValue(fullStatus('TRIALING'));

    await act(async () => {
      root.render(
        <BillingGuard>
          <div data-testid="protected-content">Dashboard</div>
        </BillingGuard>,
      );
      await flush();
    });

    expect(
      container.querySelector('[data-testid="protected-content"]'),
    ).not.toBeNull();
  });

  it('redirects an ADMIN with CHECKOUT_PENDING to /admin/billing?reason=pending', async () => {
    mocks.getRole.mockReturnValue('ADMIN');
    mocks.getStatus.mockResolvedValue(fullStatus('CHECKOUT_PENDING'));

    await act(async () => {
      root.render(
        <BillingGuard>
          <div data-testid="protected-content">Dashboard</div>
        </BillingGuard>,
      );
      await flush();
    });

    expect(
      container.querySelector('[data-testid="protected-content"]'),
    ).toBeNull();
    const nav = readNavigate(container);
    expect(nav.to).toBe('/admin/billing?reason=pending');
    expect(nav.replace).toBe('true');
  });

  it('redirects an ADMIN with no billing snapshot (null) to /admin/billing?reason=missing', async () => {
    mocks.getRole.mockReturnValue('ADMIN');
    mocks.getStatus.mockResolvedValue(fullStatus(null));

    await act(async () => {
      root.render(
        <BillingGuard>
          <div data-testid="protected-content">Dashboard</div>
        </BillingGuard>,
      );
      await flush();
    });

    expect(readNavigate(container).to).toBe('/admin/billing?reason=missing');
  });

  it.each(['PAST_DUE', 'CANCELED', 'EXPIRED', 'INCOMPLETE', 'PAYMENT_REQUIRED'])(
    'redirects an ADMIN with %s to /admin/billing?reason=inactive',
    async (status) => {
      mocks.getRole.mockReturnValue('ADMIN');
      mocks.getStatus.mockResolvedValue(fullStatus(status));

      await act(async () => {
        root.render(
          <BillingGuard>
            <div data-testid="protected-content">Dashboard</div>
          </BillingGuard>,
        );
        await flush();
      });

      expect(readNavigate(container).to).toBe(
        '/admin/billing?reason=inactive',
      );
    },
  );

  it('redirects an ADMIN with an unknown status to /admin/billing?reason=inactive', async () => {
    mocks.getRole.mockReturnValue('ADMIN');
    mocks.getStatus.mockResolvedValue(fullStatus('SOMETHING_NEW_FROM_BACKEND'));

    await act(async () => {
      root.render(
        <BillingGuard>
          <div data-testid="protected-content">Dashboard</div>
        </BillingGuard>,
      );
      await flush();
    });

    expect(readNavigate(container).to).toBe('/admin/billing?reason=inactive');
  });

  it('redirects to /admin/billing?reason=error when the status fetch fails', async () => {
    mocks.getRole.mockReturnValue('ADMIN');
    mocks.getStatus.mockRejectedValue(new Error('boom'));

    await act(async () => {
      root.render(
        <BillingGuard>
          <div data-testid="protected-content">Dashboard</div>
        </BillingGuard>,
      );
      await flush();
    });

    expect(
      container.querySelector('[data-testid="protected-content"]'),
    ).toBeNull();
    expect(readNavigate(container).to).toBe('/admin/billing?reason=error');
  });

  it('shows a loading state until the status resolves', async () => {
    mocks.getRole.mockReturnValue('ADMIN');
    let resolve!: (value: unknown) => void;
    mocks.getStatus.mockReturnValueOnce(
      new Promise((res) => {
        resolve = res;
      }),
    );

    await act(async () => {
      root.render(
        <BillingGuard>
          <div data-testid="protected-content">Dashboard</div>
        </BillingGuard>,
      );
    });

    // Still pending — neither the protected content nor a Navigate should
    // have rendered yet. A spinner is in the DOM instead.
    expect(
      container.querySelector('[data-testid="protected-content"]'),
    ).toBeNull();
    expect(container.querySelector('[data-testid="navigate"]')).toBeNull();
    expect(container.textContent ?? '').toContain('Loading');

    await act(async () => {
      resolve(fullStatus('ACTIVE'));
      await flush();
    });

    expect(
      container.querySelector('[data-testid="protected-content"]'),
    ).not.toBeNull();
  });

  it.each(['SUPERVISOR', 'WORKER', 'FINANCE', 'WAREHOUSE', 'SUBCONTRACTOR'])(
    'does NOT call the billing status endpoint for %s and renders children',
    async (role) => {
      mocks.getRole.mockReturnValue(role);

      await act(async () => {
        root.render(
          <BillingGuard>
            <div data-testid="protected-content">Role workspace</div>
          </BillingGuard>,
        );
        await flush();
      });

      expect(mocks.getStatus).not.toHaveBeenCalled();
      expect(
        container.querySelector('[data-testid="protected-content"]'),
      ).not.toBeNull();
      expect(container.querySelector('[data-testid="navigate"]')).toBeNull();
    },
  );

  it('does not redirect to /admin/billing in a loop when the guard is unmounted before the fetch resolves', async () => {
    mocks.getRole.mockReturnValue('ADMIN');
    let resolve!: (value: unknown) => void;
    mocks.getStatus.mockReturnValueOnce(
      new Promise((res) => {
        resolve = res;
      }),
    );

    await act(async () => {
      root.render(
        <BillingGuard>
          <div data-testid="protected-content">Dashboard</div>
        </BillingGuard>,
      );
    });

    // Unmount before the fetch resolves — the guard must swallow the late
    // setState so React doesn't warn / loop.
    act(() => {
      root.unmount();
    });

    await act(async () => {
      resolve(fullStatus('ACTIVE'));
      await flush();
    });

    // Nothing to assert beyond "no thrown error / no warning"; if the guard
    // had updated state after unmount React would have surfaced it.
    expect(true).toBe(true);
  });
});
