import { getBaseUrl } from '../lib/api';

/**
 * Downloads the payroll payments spreadsheet for a period — the file the
 * client keys into QuickBooks.
 *
 * The workbook is built on the server, not here, and that is deliberate. Its
 * rows are money drawn from three tables, and building it in the browser would
 * mean paging every payment out to total it client-side — the exact shape of
 * the bug that once hid the oldest bills behind a perfectly believable total.
 * The browser's job is to ask for a date range and save what comes back.
 *
 * A plain GET with no side effects: the same week can be exported as often as
 * the client wants, and nothing is marked "already exported".
 */
export async function exportPayrollPayments(params: {
  dateFrom: string;
  dateTo: string;
}): Promise<void> {
  const query = new URLSearchParams({
    format: 'xlsx',
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  });

  const res = await fetch(`${getBaseUrl()}/api/v1/admin/payroll/export?${query}`, {
    credentials: 'include',
    headers: { 'Accept-Language': navigator.language || 'en' },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Export failed (${res.status})`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payroll-payments_${params.dateFrom}_${params.dateTo}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
