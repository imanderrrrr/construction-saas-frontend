import { useTranslation } from 'react-i18next';
import { cn } from '../ui/utils';
import { Mono } from '../projects/bt';
import type { PaymentSource } from '../../services/finance';
import { Tag } from './ui';

/**
 * Where a payment came from (QuickBooks phase 4), for the payment histories of
 * Cobrar and Pagar.
 *
 * Once a document was sent to the tenant's QuickBooks and the constructora
 * reads its payments from there, what counts as paid is QuickBooks'. A payment
 * registered here before that stays in the history — never deleted — but no
 * longer counts, and says so until someone registers it in QuickBooks.
 *
 * A payment recorded here on a document that never went to QuickBooks — every
 * payment of a constructora without QuickBooks — carries no tag at all: its
 * origin says nothing new. The tooltips sit on a wrapper: Mono forwards
 * nothing but className.
 */
export function PaymentOriginTag({ source, inQuickBooks, voided, qboPaymentId, className }: {
  source?: PaymentSource;
  /** The document's payments come from QuickBooks. */
  inQuickBooks?: boolean;
  voided?: boolean;
  qboPaymentId?: string | null;
  className?: string;
}) {
  const { t } = useTranslation('finance');
  if (source === 'QUICKBOOKS') {
    return (
      <span className={cn('inline-flex flex-wrap items-center gap-1', className)} data-testid="payment-origin" data-origin="quickbooks">
        <span title={qboPaymentId ? t('paymentOrigin.qboId', { id: qboPaymentId }) : undefined}>
          <Tag tone="green">{t('paymentOrigin.quickbooks')}</Tag>
        </span>
        {voided && (
          <span title={t('paymentOrigin.voidedInQuickBooksHelp')}>
            <Tag tone="red">{t('paymentOrigin.voidedInQuickBooks')}</Tag>
          </span>
        )}
      </span>
    );
  }
  if (inQuickBooks && !voided) {
    return (
      <span className={className} title={t('paymentOrigin.notInQuickBooksHelp')} data-testid="payment-origin" data-origin="local">
        <Tag tone="orangeDashed">{t('paymentOrigin.notInQuickBooks')}</Tag>
      </span>
    );
  }
  return null;
}

/** Where "Cobrar" / "Pagar" is off because the document's payments come from QuickBooks. */
export function RegisterInQuickBooksNote({ className }: { className?: string }) {
  const { t } = useTranslation('finance');
  return (
    <Mono className={cn('block text-[10px] tracking-[0.06em] text-[#C2410C] normal-case', className)}>
      {t('paymentOrigin.registerInQuickBooks')}
    </Mono>
  );
}
