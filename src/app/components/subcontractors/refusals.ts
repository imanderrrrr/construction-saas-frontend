import type { TFunction } from 'i18next';
import { ApiError } from '../../lib/api';
import type { SubcontractorInvoiceDTO } from '../../services/subcontractors';

/**
 * What a refusal from the server means for the invoice in the window, in the
 * panel's words.
 *
 * The refusals these windows can meet get their own sentence — above all the
 * one that keeps an invoice from being booked twice, which names the bill to
 * check (from the server's `details`, or from the invoice when an older
 * server does not send them). Any other refusal says what the server said:
 * it already speaks the panel's language. No refusal at all — a dropped
 * connection — gets [fallback].
 */
export function invoiceRefusalText(err: unknown, invoice: SubcontractorInvoiceDTO, t: TFunction, fallback: string): string {
  if (!(err instanceof ApiError) || err.code === 'NETWORK_ERROR') return fallback;
  switch (err.code) {
    case 'SUBCONTRACTOR_INVOICE_IN_PAYABLES':
      return t('subcontractors:error.inPayables', {
        number: err.details?.invoiceNumber ?? invoice.invoiceNumber ?? `#${invoice.id}`,
        vendor: err.details?.vendor ?? invoice.subcontractorName ?? '',
      });
    case 'INVALID_DATES':
      return t('subcontractors:rev.error.dueBeforeReceipt');
    case 'QUICKBOOKS_PAYMENTS_IN_QBO':
      return t('subcontractors:pay.error.quickbooks');
    case 'PAYMENT_REQUEST_CONFLICT':
      return t('subcontractors:pay.error.requestConflict');
    default:
      return err.message.trim() || fallback;
  }
}
