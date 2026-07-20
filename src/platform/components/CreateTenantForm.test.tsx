import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createTenant: vi.fn(),
}));

vi.mock('../services/platformDashboard', () => ({
  createTenant: (...args: unknown[]) => mocks.createTenant(...args),
}));

// jsdom ships no matchMedia; motion's reduced-motion probe asks for it when
// the first animation mounts. Answer "no preference" so components render.
window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

import { CreateTenantForm } from './CreateTenantForm';

describe('CreateTenantForm', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.createTenant.mockReset();
    mocks.createTenant.mockResolvedValue({
      tenantId: 1,
      tenantSlug: 'acme-construcciones',
      companyName: 'Acme Construcciones',
      adminUserId: 2,
      adminUsername: 'ana.admin',
      adminEmail: 'ana@acme.example',
      planCode: 'PRO',
      billingInterval: 'MONTHLY',
      billingStatus: 'CHECKOUT_PENDING',
      billingProvider: 'PADDLE',
      setupLinkSent: true,
      customPriceUsdCents: 35_000,
      checkoutUrl: 'https://sandbox-pay.paddle.io/hsc_test',
      paddleTransactionId: 'txn_123',
      checkoutLinkEmailSent: true,
      checkoutError: null,
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    act(() => {
      root = createRoot(container);
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (onCreated = vi.fn(), onCancel = vi.fn()) => {
    act(() => {
      root.render(<CreateTenantForm onCancel={onCancel} onCreated={onCreated} />);
    });
    return { onCreated, onCancel };
  };

  // DOM order: company, slug, admin full name, admin username, admin email,
  // negotiated price (present while the billing method is Paddle — the default).
  const inputs = () => Array.from(container.querySelectorAll('input'));
  const buttonByText = (text: string) =>
    Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes(text))!;
  // Plan cards and the billing-interval segments are aria-pressed toggles now,
  // not <select>s (the approved design uses cards + a segmented control).
  const toggleByText = (text: string) =>
    Array.from(container.querySelectorAll('button[aria-pressed]')).find(b =>
      b.textContent?.includes(text),
    )! as HTMLButtonElement;

  const setValue = (el: HTMLInputElement, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => {
      setter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  };

  const fillValid = () => {
    const [company, slug, fullName, username, email, price] = inputs();
    setValue(company, 'Acme Construcciones');
    setValue(slug, 'acme-construcciones');
    setValue(fullName, 'Ana Admin');
    setValue(username, 'ana.admin');
    setValue(email, 'ana@acme.example');
    if (price) setValue(price, '350');
  };

  /**
   * The guarantee the whole flow rests on: staff never know the customer's
   * password. There must be nowhere to type one.
   */
  it('has no password field', () => {
    render();

    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(container.textContent?.toLowerCase()).not.toContain('password to');
    inputs().forEach(i => {
      expect(i.getAttribute('placeholder')?.toLowerCase() ?? '').not.toContain('password');
    });
  });

  it('suggests a slug from the company name, stripping accents', () => {
    render();
    const [company, slug] = inputs();

    setValue(company, 'Construcción Pérez & Hijos');

    expect(slug.value).toBe('construccion-perez-hijos');
  });

  it('stops auto-filling the slug once staff edit it', () => {
    render();
    const [company, slug] = inputs();

    setValue(slug, 'my-own-slug');
    setValue(company, 'Something Else Entirely');

    expect(slug.value).toBe('my-own-slug');
  });

  it('submits the form and hands the result to onCreated', async () => {
    const { onCreated } = render();
    fillValid();

    await act(async () => {
      buttonByText('Create tenant').click();
    });

    expect(mocks.createTenant).toHaveBeenCalledWith({
      companyName: 'Acme Construcciones',
      tenantSlug: 'acme-construcciones',
      adminUsername: 'ana.admin',
      adminFullName: 'Ana Admin',
      adminEmail: 'ana@acme.example',
      planCode: 'PRO',
      billingInterval: 'MONTHLY',
      billingProvider: 'PADDLE',
      customPriceUsdCents: 35_000,
    });
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 1 }));
  });

  it('defaults the billing method to Paddle, with the price field showing', () => {
    render();

    expect(toggleByText('Automatic — Paddle').getAttribute('aria-pressed')).toBe('true');
    expect(toggleByText('Manual — transfer').getAttribute('aria-pressed')).toBe('false');
    expect(inputs()).toHaveLength(6);
  });

  it('converts a decimal dollar amount to integer cents', async () => {
    render();
    fillValid();
    setValue(inputs()[5], '349.99');

    await act(async () => {
      buttonByText('Create tenant').click();
    });

    expect(mocks.createTenant).toHaveBeenCalledWith(
      expect.objectContaining({ customPriceUsdCents: 34_999 }),
    );
  });

  it('switching to Manual omits the price from the payload entirely', async () => {
    render();
    fillValid();
    setValue(inputs()[5], '350'); // typed, then the method changes — must not leak

    act(() => {
      toggleByText('Manual — transfer').click();
    });
    await act(async () => {
      buttonByText('Create tenant').click();
    });

    expect(mocks.createTenant).toHaveBeenCalledTimes(1);
    const body = mocks.createTenant.mock.calls[0][0] as Record<string, unknown>;
    expect(body.billingProvider).toBe('MANUAL');
    // The backend 400s a MANUAL request that carries a price — the key must
    // be absent, not null.
    expect(Object.keys(body)).not.toContain('customPriceUsdCents');
  });

  it('requires the negotiated price for Paddle billing', async () => {
    render();
    fillValid();
    setValue(inputs()[5], '');

    await act(async () => {
      buttonByText('Create tenant').click();
    });

    expect(mocks.createTenant).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Negotiated price');
  });

  it('rejects a price outside the $10–$50,000 bounds without calling the API', async () => {
    render();
    fillValid();
    setValue(inputs()[5], '9.99');

    await act(async () => {
      buttonByText('Create tenant').click();
    });
    expect(mocks.createTenant).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('$10.00');

    setValue(inputs()[5], '50000.01');
    await act(async () => {
      buttonByText('Create tenant').click();
    });
    expect(mocks.createTenant).not.toHaveBeenCalled();
  });

  it('rejects a price that is not a plain amount', async () => {
    render();
    fillValid();
    setValue(inputs()[5], '35o');

    await act(async () => {
      buttonByText('Create tenant').click();
    });

    expect(mocks.createTenant).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('USD amount');
  });

  it('defaults to PRO / MONTHLY and lets staff pick BUSINESS / ANNUAL', async () => {
    render();
    fillValid();
    expect(toggleByText('Pro').getAttribute('aria-pressed')).toBe('true');
    expect(toggleByText('Monthly').getAttribute('aria-pressed')).toBe('true');

    act(() => {
      toggleByText('Business').click();
    });
    act(() => {
      toggleByText('Annual').click();
    });
    expect(toggleByText('Business').getAttribute('aria-pressed')).toBe('true');
    expect(toggleByText('Annual').getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      buttonByText('Create tenant').click();
    });

    expect(mocks.createTenant).toHaveBeenCalledWith(
      expect.objectContaining({ planCode: 'BUSINESS', billingInterval: 'ANNUAL' }),
    );
  });

  it('rejects a slug the backend would reject, without calling the API', async () => {
    render();
    fillValid();
    setValue(inputs()[1], 'Not A Slug');

    await act(async () => {
      buttonByText('Create tenant').click();
    });

    expect(mocks.createTenant).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('lowercase');
  });

  it('requires an admin email — the set-up link has nowhere to go without one', async () => {
    render();
    fillValid();
    setValue(inputs()[4], '');

    await act(async () => {
      buttonByText('Create tenant').click();
    });

    expect(mocks.createTenant).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('email');
  });

  it('surfaces a backend error and stays open', async () => {
    mocks.createTenant.mockRejectedValueOnce(
      Object.assign(new Error('That tenant identifier is already taken.'), { code: 'TENANT_SLUG_TAKEN' }),
    );
    const { onCreated } = render();
    fillValid();

    await act(async () => {
      buttonByText('Create tenant').click();
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('already taken');
    expect(onCreated).not.toHaveBeenCalled();
    expect(buttonByText('Create tenant')).toBeTruthy();
  });

  it('hands Cancel to the caller', () => {
    const { onCancel } = render();

    act(() => {
      buttonByText('Cancel').click();
    });

    expect(onCancel).toHaveBeenCalled();
  });
});
