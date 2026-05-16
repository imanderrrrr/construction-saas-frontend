import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', () => ({
  api: vi.fn(),
}));

import { api } from '../lib/api';
import {
  BillingService,
  type ChangePlanRequest,
  type CreateCheckoutRequest,
} from './billing';

const apiMock = vi.mocked(api);

describe('BillingService.createCheckout', () => {
  beforeEach(() => {
    apiMock.mockReset();
  });

  it('sends only planCode and billingInterval to checkout API', async () => {
    apiMock.mockResolvedValueOnce({ transactionId: 'txn_123' });

    const widenedRequest = {
      planCode: 'PRO',
      billingInterval: 'ANNUAL',
      tenantId: 'tenant_123',
      tenantSlug: 'acme',
      priceId: 'pri_123',
      productId: 'pro_123',
      amount: 100,
      currency: 'USD',
      trialDays: 14,
      total: 100,
      cardNumber: '4242424242424242',
    } as unknown as CreateCheckoutRequest;

    await BillingService.createCheckout(widenedRequest);

    expect(apiMock).toHaveBeenCalledWith('/api/v1/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({
        planCode: 'PRO',
        billingInterval: 'ANNUAL',
      }),
    });

    const [, options] = apiMock.mock.calls[0];
    const body = JSON.parse(String(options.body));

    expect(body).toEqual({
      planCode: 'PRO',
      billingInterval: 'ANNUAL',
    });
    expect(body).not.toHaveProperty('tenantId');
    expect(body).not.toHaveProperty('tenantSlug');
    expect(body).not.toHaveProperty('priceId');
    expect(body).not.toHaveProperty('productId');
    expect(body).not.toHaveProperty('amount');
    expect(body).not.toHaveProperty('currency');
    expect(body).not.toHaveProperty('trialDays');
    expect(body).not.toHaveProperty('total');
    expect(body).not.toHaveProperty('cardNumber');
  });
});

describe('BillingService.getStatus', () => {
  beforeEach(() => {
    apiMock.mockReset();
  });

  it('reads billing status without sending tenantId or checkout fields', async () => {
    apiMock.mockResolvedValueOnce({
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
      lastEventId: 'evt_123',
      lastEventOccurredAt: '2026-05-01T12:30:00Z',
    });

    await BillingService.getStatus();

    expect(apiMock).toHaveBeenCalledWith('/api/v1/billing/status');
    expect(apiMock).toHaveBeenCalledTimes(1);
  });
});

describe('BillingService.changePlan', () => {
  beforeEach(() => {
    apiMock.mockReset();
  });

  it('POSTs to /billing/subscription/change-plan with only planCode + billingInterval', async () => {
    apiMock.mockResolvedValueOnce({ accepted: true });

    await BillingService.changePlan({
      planCode: 'BUSINESS',
      billingInterval: 'ANNUAL',
    });

    expect(apiMock).toHaveBeenCalledWith(
      '/api/v1/billing/subscription/change-plan',
      {
        method: 'POST',
        body: JSON.stringify({
          planCode: 'BUSINESS',
          billingInterval: 'ANNUAL',
        }),
      },
    );
  });

  it('strips any extra fields and never sends tenantId, priceId, amount or Paddle ids', async () => {
    apiMock.mockResolvedValueOnce({ accepted: true });

    const widenedRequest = {
      planCode: 'PRO',
      billingInterval: 'MONTHLY',
      tenantId: 'tenant_999',
      tenantSlug: 'acme',
      priceId: 'pri_999',
      productId: 'pro_999',
      amount: 399,
      currency: 'USD',
      paddleSubscriptionId: 'sub_999',
      paddleCustomerId: 'ctm_999',
      trialDays: 14,
    } as unknown as ChangePlanRequest;

    await BillingService.changePlan(widenedRequest);

    const [endpoint, options] = apiMock.mock.calls[0];
    expect(endpoint).toBe('/api/v1/billing/subscription/change-plan');
    expect(options.method).toBe('POST');

    const body = JSON.parse(String(options.body));
    expect(body).toEqual({
      planCode: 'PRO',
      billingInterval: 'MONTHLY',
    });
    expect(body).not.toHaveProperty('tenantId');
    expect(body).not.toHaveProperty('tenantSlug');
    expect(body).not.toHaveProperty('priceId');
    expect(body).not.toHaveProperty('productId');
    expect(body).not.toHaveProperty('amount');
    expect(body).not.toHaveProperty('currency');
    expect(body).not.toHaveProperty('paddleSubscriptionId');
    expect(body).not.toHaveProperty('paddleCustomerId');
    expect(body).not.toHaveProperty('trialDays');
  });
});
