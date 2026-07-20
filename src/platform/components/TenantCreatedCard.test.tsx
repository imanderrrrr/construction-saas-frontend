import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import { TenantCreatedCard } from './TenantCreatedCard';
import type { CreateTenantResponse } from '../types';

const PADDLE_CREATED: CreateTenantResponse = {
  tenantId: 7,
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
  checkoutUrl: 'https://sandbox-pay.paddle.io/hsc_test123',
  paddleTransactionId: 'txn_123',
  checkoutLinkEmailSent: true,
  checkoutError: null,
};

describe('TenantCreatedCard', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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

  const render = (created: CreateTenantResponse) => {
    const onCreateAnother = vi.fn();
    const onBack = vi.fn();
    act(() => {
      root.render(
        <MemoryRouter>
          <TenantCreatedCard created={created} onCreateAnother={onCreateAnother} onBack={onBack} />
        </MemoryRouter>,
      );
    });
    return { onCreateAnother, onBack };
  };

  it('shows the payment link with the negotiated price for a Paddle tenant', () => {
    render(PADDLE_CREATED);

    const text = container.textContent ?? '';
    expect(text).toContain('awaiting its first payment');
    expect(text).toContain('https://sandbox-pay.paddle.io/hsc_test123');
    expect(text).toContain('$350.00/mo');
    expect(text).toContain('Also emailed to');
    expect(text).toContain('auto-suspended');
  });

  it('copies the checkout link to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(PADDLE_CREATED);

    const copyBtn = Array.from(container.querySelectorAll('button')).find(b =>
      b.textContent?.includes('Copy link'),
    )!;
    await act(async () => {
      copyBtn.click();
    });

    expect(writeText).toHaveBeenCalledWith('https://sandbox-pay.paddle.io/hsc_test123');
    expect(container.textContent).toContain('Copied');
  });

  it('tells staff to send the link themselves when the payment email failed', () => {
    render({ ...PADDLE_CREATED, checkoutLinkEmailSent: false });

    expect(container.textContent).toContain('The payment email could not be sent');
  });

  it('surfaces a minting failure with the error code and a path to retry', () => {
    render({ ...PADDLE_CREATED, checkoutUrl: null, paddleTransactionId: null, checkoutError: 'BILLING_CHECKOUT_URL_MISSING' });

    const text = container.textContent ?? '';
    expect(text).toContain('could not be issued');
    expect(text).toContain('BILLING_CHECKOUT_URL_MISSING');
    const link = container.querySelector('a[href="/platform/tenants/7"]');
    expect(link?.textContent).toContain('tenant page');
  });

  it('renders the manual flow without any payment-link block', () => {
    render({
      ...PADDLE_CREATED,
      billingProvider: 'MANUAL',
      billingStatus: 'ACTIVE',
      customPriceUsdCents: null,
      checkoutUrl: null,
      paddleTransactionId: null,
      checkoutLinkEmailSent: null,
    });

    const text = container.textContent ?? '';
    expect(text).toContain('is up and running');
    expect(text).toContain('Manual — outside the product');
    expect(text).not.toContain('Payment link');
    expect(text).not.toContain('could not be issued');
  });

  it('wires the two footer actions', () => {
    const { onCreateAnother, onBack } = render(PADDLE_CREATED);
    const byText = (t: string) =>
      Array.from(container.querySelectorAll('button')).find(b => b.textContent?.trim() === t)!;

    act(() => byText('Create another').click());
    act(() => byText('Back to tenants').click());

    expect(onCreateAnother).toHaveBeenCalled();
    expect(onBack).toHaveBeenCalled();
  });
});
