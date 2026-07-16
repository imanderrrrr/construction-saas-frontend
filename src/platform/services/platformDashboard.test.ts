import { beforeEach, describe, expect, it, vi } from 'vitest';

// The service is a thin shell over the platform fetch wrapper — mock it and
// assert the wire contract (path, method, body shape).
const platformApiMock = vi.fn();
vi.mock('../lib/platformApi', () => ({
  platformApi: (...args: unknown[]) => platformApiMock(...args),
}));

import { createTenant } from './platformDashboard';

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
