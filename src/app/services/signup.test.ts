import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

// Mock the shared api wrapper at module load time. The service is a
// thin shell over `api()` — these tests verify the body shape and that
// no sensitive fields are appended.
const apiMock = vi.fn();
vi.mock('../lib/api', () => ({
  api: (...args: unknown[]) => apiMock(...args),
}));

import {
  SignupService,
  SIGNUP_INTENT_STORAGE_KEY,
  clearSignupIntent,
  readSignupIntent,
  rememberSignupIntent,
} from './signup';

describe('SignupService', () => {
  beforeEach(() => {
    apiMock.mockReset();
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('createCheckoutIntent posts the form payload as-is — no extra fields', async () => {
    apiMock.mockResolvedValueOnce({
      signupIntentId: 'uuid-1',
      paddleTransactionId: 'txn_1',
      transactionId: 'txn_1',
      checkoutUrl: null,
      planCode: 'PRO',
      billingInterval: 'MONTHLY',
      expiresAt: '2026-05-13T16:00:00Z',
    });

    await SignupService.createCheckoutIntent({
      companyName: 'Co',
      workspaceIdentifier: 'co',
      adminUsername: 'u',
      adminPassword: 'pw12345678',
      adminFullName: 'Full',
      adminEmail: 'u@co.test',
      planCode: 'PRO',
      billingInterval: 'MONTHLY',
      startTrial: false,
    });

    expect(apiMock).toHaveBeenCalledTimes(1);
    const [endpoint, options] = apiMock.mock.calls[0];
    expect(endpoint).toBe('/api/v1/signup/checkout');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    // The body must not be smuggling Paddle internals from the client.
    expect(body).not.toHaveProperty('priceId');
    expect(body).not.toHaveProperty('amount');
    expect(body).not.toHaveProperty('currency');
    expect(body).not.toHaveProperty('tenantId');
    expect(body.planCode).toBe('PRO');
    expect(body.adminPassword).toBe('pw12345678');
    // The trial choice ("Pagar ahora" => false) must reach the backend.
    expect(body.startTrial).toBe(false);
  });

  it('completeSignup posts only the signupIntentId', async () => {
    apiMock.mockResolvedValueOnce({
      role: 'ADMIN',
      username: 'u',
      expiresInMinutes: 480,
    });

    await SignupService.completeSignup({ signupIntentId: 'uuid-1' });

    expect(apiMock).toHaveBeenCalledTimes(1);
    const [endpoint, options] = apiMock.mock.calls[0];
    expect(endpoint).toBe('/api/v1/signup/complete');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ signupIntentId: 'uuid-1' });
  });
});

describe('signup intent sessionStorage helpers', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('roundtrips a valid intent', () => {
    rememberSignupIntent({
      signupIntentId: 'uuid-1',
      planCode: 'PRO',
      billingInterval: 'ANNUAL',
    });

    const recovered = readSignupIntent();
    expect(recovered).toEqual({
      signupIntentId: 'uuid-1',
      planCode: 'PRO',
      billingInterval: 'ANNUAL',
    });
  });

  it('stores only the intent id plus minimum plan metadata, never password or workspace slug', () => {
    rememberSignupIntent({
      signupIntentId: 'uuid-1',
      planCode: 'PRO',
      billingInterval: 'MONTHLY',
    });

    const raw = sessionStorage.getItem(SIGNUP_INTENT_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(raw).not.toContain('password');
    expect(raw).not.toContain('workspaceIdentifier');
    expect(raw).not.toContain('tenantSlug');
    expect(raw).not.toContain('adminEmail');
    expect(raw).not.toContain('u@co.test');
    expect(JSON.parse(raw ?? '{}')).toEqual({
      signupIntentId: 'uuid-1',
      planCode: 'PRO',
      billingInterval: 'MONTHLY',
    });
  });

  it('readSignupIntent returns null when storage is empty or malformed', () => {
    expect(readSignupIntent()).toBeNull();

    sessionStorage.setItem(SIGNUP_INTENT_STORAGE_KEY, 'not-json');
    expect(readSignupIntent()).toBeNull();

    sessionStorage.setItem(
      SIGNUP_INTENT_STORAGE_KEY,
      JSON.stringify({ signupIntentId: 'x' }), // missing the rest
    );
    expect(readSignupIntent()).toBeNull();

    sessionStorage.setItem(
      SIGNUP_INTENT_STORAGE_KEY,
      JSON.stringify({
        signupIntentId: 'x',
        planCode: 'FREE',
        billingInterval: 'WEEKLY',
      }),
    );
    expect(readSignupIntent()).toBeNull();
  });

  it('clearSignupIntent removes the stored value', () => {
    rememberSignupIntent({
      signupIntentId: 'uuid-1',
      planCode: 'PRO',
      billingInterval: 'MONTHLY',
    });
    clearSignupIntent();
    expect(readSignupIntent()).toBeNull();
  });
});
