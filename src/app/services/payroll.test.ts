import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', () => ({ getBaseUrl: () => '' }));

import { exportPayrollPayments } from './payroll';

/**
 * The payroll export is money, so the thing worth pinning here is that the
 * browser never assembles it: one request, no paging, no client-side totalling.
 * A future "let's just build the sheet here" refactor should break these.
 */
describe('exportPayrollPayments', () => {
  const fetchMock = vi.fn();
  /**
   * The anchor the service hands to the DOM. Spying on the append (rather than
   * on the click) keeps the real implementation running, so the service's own
   * `removeChild` still finds its node. Typed through a helper because naming
   * `vi.spyOn<..., 'appendChild'>` explicitly does not satisfy its constraint.
   */
  const spyOnAppend = () => vi.spyOn(document.body, 'appendChild');
  let appendSpy: ReturnType<typeof spyOnAppend>;
  const savedAnchor = () => appendSpy.mock.calls[0]?.[0] as HTMLAnchorElement | undefined;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    // jsdom has no object URLs and no real downloads. Patch the two statics in
    // place rather than replacing `URL` — the constructor is still needed.
    Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:payroll', configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: () => {}, configurable: true });
    // jsdom would log "navigation not implemented" on a real anchor click.
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    appendSpy = spyOnAppend();
  });

  afterEach(() => vi.restoreAllMocks());

  it('asks the server for one xlsx over the requested range', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['x']) });

    await exportPayrollPayments({ dateFrom: '2026-07-27', dateTo: '2026-08-02' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    const query = new URLSearchParams(url.split('?')[1]);
    expect(url).toContain('/api/v1/admin/payroll/export');
    expect(query.get('format')).toBe('xlsx');
    expect(query.get('dateFrom')).toBe('2026-07-27');
    expect(query.get('dateTo')).toBe('2026-08-02');
    // No page/size: the server returns the whole period in one file. A paged
    // sweep here would be the shape of the bug that once hid the oldest bills.
    expect(query.get('page')).toBeNull();
    expect(query.get('size')).toBeNull();
    expect(init.credentials).toBe('include');
  });

  it('names the file after the period so re-running a week overwrites nothing', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['x']) });

    await exportPayrollPayments({ dateFrom: '2026-07-27', dateTo: '2026-08-02' });

    expect(savedAnchor()!.download).toBe('payroll-payments_2026-07-27_2026-08-02.xlsx');
  });

  it('surfaces a failed download instead of saving an empty file', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false, status: 403,
      json: async () => ({ message: 'Forbidden' }),
    });

    await expect(
      exportPayrollPayments({ dateFrom: '2026-07-27', dateTo: '2026-08-02' }),
    ).rejects.toThrow('Forbidden');
    expect(appendSpy).not.toHaveBeenCalled();
  });
});
