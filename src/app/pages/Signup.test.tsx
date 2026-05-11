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
  navigate: vi.fn(),
  signup: vi.fn(),
  searchParams: new URLSearchParams(),
}));

const dashboardRoutes: Record<string, string> = {
  ADMIN: '/admin/dashboard',
  SUPERVISOR: '/supervisor/dashboard',
  WORKER: '/worker/dashboard',
};

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
      return key;
    },
  }),
}));

vi.mock('react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  Navigate: ({ to }: { to: string }) => (
    <div data-testid="navigate" data-to={to} />
  ),
  useNavigate: () => mocks.navigate,
  useSearchParams: () => [mocks.searchParams],
}));

vi.mock('../services/auth', () => ({
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string, public details?: unknown, public code?: string) {
      super(message);
      this.name = 'ApiError';
    }
  },
  AuthService: {
    signup: mocks.signup,
    getDashboardRoute: (role: string) =>
      dashboardRoutes[role] ?? '/',
  },
}));

vi.mock('../components/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <span data-testid="language-switcher" />,
}));

import { Signup } from './Signup';

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

function navigatedToAdminBilling(): boolean {
  return mocks.navigate.mock.calls.some(([to]) =>
    String(to).startsWith('/admin/billing'),
  );
}

describe('Signup selected plan intent', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.signup.mockReset();
    mocks.signup.mockResolvedValue({
      role: 'ADMIN',
      username: 'admin',
      expiresInMinutes: 480,
    });
    mocks.searchParams = new URLSearchParams(
      'plan=PRO&interval=ANNUAL',
    );

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

  it('shows the selected plan without adding billing fields to signup payload', async () => {
    await renderSignup(root);

    expect(container.textContent).toContain('Selected plan');
    expect(container.textContent).toContain('Plan Pro');
    expect(container.textContent).toContain('Interval Annual');
    expect(container.textContent).toContain('No charge copy');

    await fillValidSignupForm(container);
    await submit(container);

    expect(mocks.signup).toHaveBeenCalledTimes(1);
    const payload = mocks.signup.mock.calls[0][0];
    expect(payload).toEqual({
      companyName: 'Acme Construction',
      tenantSlug: 'acme',
      adminFullName: 'Ada Admin',
      adminEmail: 'ada@example.com',
      adminUsername: 'ada',
      adminPassword: 'password123',
    });
    expect(payload).not.toHaveProperty('plan');
    expect(payload).not.toHaveProperty('interval');
    expect(payload).not.toHaveProperty('billing');
    expect(payload).not.toHaveProperty('priceId');
    expect(payload).not.toHaveProperty('amount');
    expect(payload).not.toHaveProperty('currency');
  });

  it('redirects new admins to billing with selected plan params', async () => {
    await renderSignup(root);

    await fillValidSignupForm(container);
    await submit(container);

    expect(mocks.navigate).toHaveBeenCalledWith(
      '/admin/billing?plan=PRO&interval=ANNUAL&from=signup',
    );
  });

  it('keeps the role dashboard redirect for non-admin signups with valid plan intent', async () => {
    mocks.searchParams = new URLSearchParams('plan=PRO&interval=MONTHLY');
    mocks.signup.mockResolvedValueOnce({
      role: 'SUPERVISOR',
      username: 'supervisor',
      expiresInMinutes: 480,
    });

    await renderSignup(root);
    await fillValidSignupForm(container);
    await submit(container);

    expect(mocks.navigate).toHaveBeenCalledWith('/supervisor/dashboard');
    expect(navigatedToAdminBilling()).toBe(false);
  });

  it.each([
    ['without query params', ''],
    ['with invalid plan', 'plan=garbage&interval=MONTHLY'],
    ['with invalid interval', 'plan=PRO&interval=garbage'],
    ['with both query params invalid', 'plan=garbage&interval=garbage'],
    ['missing interval', 'plan=PRO'],
    ['missing plan', 'interval=MONTHLY'],
  ])(
    'redirects to /choose-plan when /signup is reached %s',
    async (_label, queryString) => {
      mocks.searchParams = new URLSearchParams(queryString);

      await renderSignup(root);

      const navigateNode = container.querySelector<HTMLElement>(
        '[data-testid="navigate"]',
      );
      expect(navigateNode).not.toBeNull();
      expect(navigateNode!.getAttribute('data-to')).toBe('/choose-plan');

      // The form should not render at all, so signup must not be invoked.
      expect(mocks.signup).not.toHaveBeenCalled();
      expect(container.querySelector('form')).toBeNull();
    },
  );
});
