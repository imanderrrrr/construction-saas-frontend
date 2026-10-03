import { afterEach, describe, expect, it, vi } from 'vitest';
import { newRequestKey } from './requestKey';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('newRequestKey', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('is a v4 UUID and never repeats', () => {
    const a = newRequestKey();
    const b = newRequestKey();
    expect(a).toMatch(UUID);
    expect(b).toMatch(UUID);
    expect(a).not.toBe(b);
  });

  it('fits the server column (64 characters at most)', () => {
    expect(newRequestKey().length).toBeLessThanOrEqual(64);
  });

  it('still works where crypto.randomUUID does not exist (plain http)', () => {
    vi.stubGlobal('crypto', { getRandomValues: (b: Uint8Array) => { b.fill(7); return b; } });
    expect(newRequestKey()).toMatch(UUID);
  });
});
