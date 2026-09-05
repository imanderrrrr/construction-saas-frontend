import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { retryAfterMinutes } from './rateLimit';

describe('retryAfterMinutes', () => {
  it('rounds the Retry-After seconds up to whole minutes', () => {
    expect(retryAfterMinutes(new ApiError(429, 'x', undefined, 'RATE_LIMITED', 1800), 30)).toBe(30);
    expect(retryAfterMinutes(new ApiError(429, 'x', undefined, 'RATE_LIMITED', 61), 30)).toBe(2);
    expect(retryAfterMinutes(new ApiError(429, 'x', undefined, 'RATE_LIMITED', 5), 30)).toBe(1);
  });

  it('falls back to the screen default without a header, or for a non-API error', () => {
    expect(retryAfterMinutes(new ApiError(429, 'x'), 15)).toBe(15);
    expect(retryAfterMinutes(new Error('network'), 30)).toBe(30);
  });
});
