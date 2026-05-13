import { describe, expect, it } from 'vitest';

import {
  billingBlockReason,
  isBillingAllowed,
  ACCESS_ALLOWED_STATUSES,
} from './billing-access';

describe('isBillingAllowed', () => {
  it('allows ACTIVE', () => {
    expect(isBillingAllowed('ACTIVE')).toBe(true);
  });

  it('allows TRIALING', () => {
    expect(isBillingAllowed('TRIALING')).toBe(true);
  });

  it.each([
    'CHECKOUT_PENDING',
    'PAST_DUE',
    'CANCELED',
    'EXPIRED',
    'INCOMPLETE',
    'PAYMENT_REQUIRED',
    'NO_SUBSCRIPTION',
    'UNKNOWN_FROM_BACKEND',
    '',
  ] as const)('blocks %s', (value) => {
    expect(isBillingAllowed(value)).toBe(false);
  });

  it('blocks null', () => {
    expect(isBillingAllowed(null)).toBe(false);
  });

  it('blocks undefined', () => {
    expect(isBillingAllowed(undefined)).toBe(false);
  });

  it('exposes the canonical allowed set', () => {
    expect([...ACCESS_ALLOWED_STATUSES]).toEqual(['ACTIVE', 'TRIALING']);
  });
});

describe('billingBlockReason', () => {
  it('returns "missing" for null', () => {
    expect(billingBlockReason(null)).toBe('missing');
  });

  it('returns "missing" for undefined', () => {
    expect(billingBlockReason(undefined)).toBe('missing');
  });

  it('returns "missing" for NO_SUBSCRIPTION', () => {
    expect(billingBlockReason('NO_SUBSCRIPTION')).toBe('missing');
  });

  it('returns "pending" for CHECKOUT_PENDING', () => {
    expect(billingBlockReason('CHECKOUT_PENDING')).toBe('pending');
  });

  it.each([
    'PAST_DUE',
    'CANCELED',
    'EXPIRED',
    'INCOMPLETE',
    'PAYMENT_REQUIRED',
    'UNKNOWN_FROM_BACKEND',
  ] as const)('returns "inactive" for %s', (value) => {
    expect(billingBlockReason(value)).toBe('inactive');
  });
});
