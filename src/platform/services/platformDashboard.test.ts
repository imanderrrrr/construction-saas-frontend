import { beforeEach, describe, expect, it, vi } from 'vitest';

// The service is a thin shell over the platform fetch wrapper — mock it and
// assert the wire contract (path, method, body shape).
const platformApiMock = vi.fn();
vi.mock('../lib/platformApi', () => ({
  platformApi: (...args: unknown[]) => platformApiMock(...args),
}));

import { createTenant, getTenantPayments, recordTenantPayment } from './platformDashboard';

describe('createTenant', () => {
  beforeEach(() => {
    platformApiMock.mockReset();
    platformApiMock.mockResolvedValue({});
  });

  it('POSTs to /platform/tenants with the form payload', async () => {
    await createTenant({
      companyName: 'Acme Construcciones',
      tenantSlug: 'acme-construcciones',
      adminUsername: 'ana.admin',
      adminFullName: 'Ana Admin',
      adminEmail: 'ana@acme.example',
      planCode: 'PRO',
      billingInterval: 'MONTHLY',
    });

    expect(platformApiMock).toHaveBeenCalledWith('/platform/tenants', {
      method: 'POST',
      body: {
        companyName: 'Acme Construcciones',
        tenantSlug: 'acme-construcciones',
        adminUsername: 'ana.admin',
        adminFullName: 'Ana Admin',
        adminEmail: 'ana@acme.example',
        planCode: 'PRO',
        billingInterval: 'MONTHLY',
      },
    });
  });

  /**
   * Staff never choose a customer's password — the backend mints a random one
   * it discards and emails a set-your-password link. If a password field ever
   * appears on this request, that guarantee is gone.
   */
  it('never sends a password', async () => {
    await createTenant({
      companyName: 'Acme',
      tenantSlug: 'acme',
      adminUsername: 'ana',
      adminFullName: 'Ana Admin',
      adminEmail: 'ana@acme.example',
    });

    const [, options] = platformApiMock.mock.calls[0];
    const body = (options as { body: Record<string, unknown> }).body;
    expect(Object.keys(body)).not.toContain('adminPassword');
    expect(JSON.stringify(body).toLowerCase()).not.toContain('password');
  });

  it('returns the backend response to the caller', async () => {
    platformApiMock.mockResolvedValueOnce({
      tenantId: 42,
      tenantSlug: 'acme',
      setupLinkSent: true,
    });

    const res = await createTenant({
      companyName: 'Acme',
      tenantSlug: 'acme',
      adminUsername: 'ana',
      adminFullName: 'Ana Admin',
      adminEmail: 'ana@acme.example',
    });

    expect(res.tenantId).toBe(42);
    expect(res.setupLinkSent).toBe(true);
  });
});

describe('getTenantPayments', () => {
  beforeEach(() => {
    platformApiMock.mockReset();
    platformApiMock.mockResolvedValue({ tenantId: 7, payments: [] });
  });

  it('GETs the tenant payments panel', async () => {
    await getTenantPayments(7);
    expect(platformApiMock).toHaveBeenCalledWith('/platform/tenants/7/payments');
  });
});

describe('recordTenantPayment', () => {
  beforeEach(() => {
    platformApiMock.mockReset();
    platformApiMock.mockResolvedValue({ tenantId: 7, billingStatus: 'ACTIVE', payments: [] });
  });

  it('POSTs the payment body to the tenant payments endpoint', async () => {
    await recordTenantPayment(7, {
      amountCents: 35_000,
      paidAt: '2026-07-12T00:00:00.000Z',
      method: 'Wire transfer',
      reference: '#4471',
      coversUntil: '2026-08-12T23:59:59.999Z',
    });

    expect(platformApiMock).toHaveBeenCalledWith('/platform/tenants/7/payments', {
      method: 'POST',
      body: {
        amountCents: 35_000,
        paidAt: '2026-07-12T00:00:00.000Z',
        method: 'Wire transfer',
        reference: '#4471',
        coversUntil: '2026-08-12T23:59:59.999Z',
      },
    });
  });

  it('returns the updated panel to the caller', async () => {
    platformApiMock.mockResolvedValueOnce({
      tenantId: 7,
      billingStatus: 'ACTIVE',
      currentPeriodEndsAt: '2026-08-12T23:59:59.999Z',
      payments: [{ id: 1 }],
    });

    const res = await recordTenantPayment(7, {
      amountCents: 35_000,
      paidAt: '2026-07-12T00:00:00.000Z',
      method: 'Wire',
      coversUntil: '2026-08-12T23:59:59.999Z',
    });

    expect(res.billingStatus).toBe('ACTIVE');
    expect(res.payments).toHaveLength(1);
  });
});
