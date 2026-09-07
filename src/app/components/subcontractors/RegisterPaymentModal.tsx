import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../ui/utils';
import { FIELD_LIMITS } from '../../../shared/fieldLimits';
import { registerPayment, type SubcontractorInvoiceDTO } from '../../services/subcontractors';
import { BtModal } from '../bt/windows';
import { PrimaryButton, SecondaryButton } from '../onboarding/chrome';
import { FieldHint, FieldLabel, INPUT, Mono, PaperNote } from '../projects/bt';
import { fmtMoney, InvoiceStatusChip } from './bits';

/**
 * 09 — record a payment.
 *
 * It records; it does not move money. The old button was green, and green in
 * this panel means "approved" and nothing else — a green action button broke
 * the one colour rule the panel has.
 *
 * The amount is set in 46 px display because it is the one number here that
 * costs money if it is wrong, and it is the last thing read before confirming.
 */

const MAX_REFERENCE = FIELD_LIMITS.REFERENCE;

export function RegisterPaymentModal({ open, onOpenChange, invoice, onPaid }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: SubcontractorInvoiceDTO | null;
  onPaid: (invoice: SubcontractorInvoiceDTO) => void;
}) {
  const { t } = useTranslation(['subcontractors', 'common']);
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReference('');
    setSaving(false);
    setError(false);
  }, [open, invoice?.id]);

  if (!invoice) return null;

  const submit = async () => {
    setSaving(true);
    setError(false);
    try {
      const updated = await registerPayment(invoice.id, { paymentReference: reference.trim() || null });
      onPaid(updated);
      onOpenChange(false);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <BtModal
      open={open}
      onOpenChange={onOpenChange}
      width={460}
      dismissible={false}
      closeDisabled={saving}
      kicker={t('subcontractors:pay.kicker')}
      title={t('subcontractors:pay.title')}
      footer={
        <>
          <SecondaryButton onClick={() => onOpenChange(false)} disabled={saving}>{t('common:buttons.cancel')}</SecondaryButton>
          <PrimaryButton onClick={submit} disabled={saving}>
            {saving ? t('subcontractors:pay.submitting') : t('subcontractors:pay.submit')}
          </PrimaryButton>
        </>
      }
    >
      <div className="bg-[#FBF8F2] border border-[#EDE7DB] px-[17px] py-[15px]">
        <div className="flex items-center justify-between gap-3">
          <Mono className="text-[11.5px] font-semibold tracking-[0.06em] text-[#0A0A0A]">
            {invoice.invoiceNumber ?? `#${invoice.id}`}
          </Mono>
          <InvoiceStatusChip status={invoice.status} />
        </div>
        <div className="text-[12.5px] leading-[1.45] text-[#5A5346] mt-2">
          {invoice.subcontractorName ?? ''} · {invoice.jobTitle}
        </div>
        <div className="font-bt-display font-extrabold text-[46px] leading-none tabular-nums text-[#0A0A0A] mt-2">
          {fmtMoney(invoice.amountCents)}
        </div>
      </div>

      <div className="mt-[14px]">
        <FieldLabel htmlFor={`pay-ref-${invoice.id}`}>{t('subcontractors:pay.reference')}</FieldLabel>
        <input
          id={`pay-ref-${invoice.id}`}
          value={reference}
          onChange={e => setReference(e.target.value)}
          placeholder={t('subcontractors:pay.referencePlaceholder')}
          maxLength={MAX_REFERENCE}
          className={cn(INPUT)}
        />
        <FieldHint>{t('subcontractors:pay.referenceHint', { max: MAX_REFERENCE })}</FieldHint>
      </div>

      <PaperNote className="mt-4">{t('subcontractors:pay.note')}</PaperNote>

      {error && (
        <PaperNote tone="red" className="mt-3">
          <div className="font-semibold">{t('subcontractors:pay.error.title')}</div>
          <div className="mt-1">{t('subcontractors:pay.error.hint')}</div>
        </PaperNote>
      )}
    </BtModal>
  );
}
