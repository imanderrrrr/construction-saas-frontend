import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', () => ({
  api: vi.fn(),
}));

import { api } from '../lib/api';
import {
  BillingService,
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
